-- ==========================================
-- 038 · Personas de Mis sorpresas
--
-- La sección de regalos de DailyHub asigna cada regalo a una persona con
-- foto y cumpleaños, y muestra el cumpleaños de todos de un vistazo. Tamp
-- no tenía dónde guardarlas: esta migración crea `tamp_people` y añade
-- `person_id` a `tamp_entries`.
--
-- Decisiones:
--   · Las personas son de la pareja: los dos leéis la lista (los
--     cumpleaños importan a los dos). Cada uno escribe su propia fila,
--     igual que en `tamp_entries`.
--   · La foto va dentro de la fila como data URL (ya recortada por la
--     app), no a un bucket compartido.
--   · El borrado es suave (`removed_at`), como las sorpresas.
--   · `person_id` usa ON DELETE SET NULL: quitar una persona no borra las
--     sorpresas, solo deja de asignarlas.
--
-- No toca políticas ni datos existentes. Es idempotente.
--
-- Sin esta migración la pantalla sigue funcionando: detecta que la tabla
-- no existe y esconde Personas y la asignación de cada sorpresa.
-- ==========================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.tamp_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL DEFAULT public.current_couple_id() REFERENCES public.couples,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  birthday date,
  photo text NOT NULL DEFAULT '' CHECK (length(photo) <= 400000),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);

CREATE INDEX IF NOT EXISTS tamp_people_couple ON public.tamp_people(couple_id, name);

ALTER TABLE public.tamp_people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tamp_people FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tamp_people TO authenticated;
GRANT INSERT (name, birthday, photo, notes) ON TABLE public.tamp_people TO authenticated;
GRANT UPDATE (name, birthday, photo, notes, removed_at) ON TABLE public.tamp_people TO authenticated;
GRANT ALL ON public.tamp_people TO service_role;

DROP POLICY IF EXISTS tamp_people_read ON public.tamp_people;
CREATE POLICY tamp_people_read ON public.tamp_people FOR SELECT TO authenticated USING (
  public.is_enabled() AND couple_id = public.current_couple_id()
  AND (removed_at IS NULL OR removed_at > now() - interval '30 days')
);

DROP POLICY IF EXISTS tamp_people_add ON public.tamp_people;
CREATE POLICY tamp_people_add ON public.tamp_people FOR INSERT TO authenticated WITH CHECK (
  public.is_enabled() AND couple_id = public.current_couple_id() AND author_id = auth.uid()
);

DROP POLICY IF EXISTS tamp_people_edit ON public.tamp_people;
CREATE POLICY tamp_people_edit ON public.tamp_people FOR UPDATE TO authenticated USING (
  public.is_enabled() AND couple_id = public.current_couple_id() AND author_id = auth.uid()
) WITH CHECK (
  public.is_enabled() AND couple_id = public.current_couple_id() AND author_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.tamp_people_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  IF OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL THEN NEW.removed_at = now();
  ELSIF OLD.removed_at IS NOT NULL AND NEW.removed_at IS NOT NULL THEN NEW.removed_at = OLD.removed_at;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tamp_people_timestamp ON public.tamp_people;
CREATE TRIGGER tamp_people_timestamp BEFORE UPDATE ON public.tamp_people
  FOR EACH ROW EXECUTE FUNCTION public.tamp_people_timestamp();

-- Asignación de una sorpresa a una persona.
ALTER TABLE public.tamp_entries
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.tamp_people(id) ON DELETE SET NULL;

ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_person_surprise;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_person_surprise
  CHECK (kind = 'surprise' OR person_id IS NULL);

GRANT INSERT (person_id) ON TABLE public.tamp_entries TO authenticated;
GRANT UPDATE (person_id) ON TABLE public.tamp_entries TO authenticated;

COMMIT;

-- ==========================================
-- ROLLBACK (devuelve la tabla a como estaba antes de 038)
--
-- OJO: borra personas y asignaciones. Las sorpresas siguen ahí.
--
-- BEGIN;
-- ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_person_surprise;
-- ALTER TABLE public.tamp_entries DROP COLUMN IF EXISTS person_id;
-- DROP TRIGGER IF EXISTS tamp_people_timestamp ON public.tamp_people;
-- DROP FUNCTION IF EXISTS public.tamp_people_timestamp();
-- DROP TABLE IF EXISTS public.tamp_people;
-- COMMIT;
-- ==========================================
