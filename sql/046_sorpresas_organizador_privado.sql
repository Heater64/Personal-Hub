-- ==========================================
-- 046 · Mis sorpresas: organizador privado por usuario
--
-- Convierte Mis sorpresas en un organizador personal:
--
--   · Las personas dejan de ser de la pareja: cada usuario solo ve, crea
--     y edita las suyas (`author_id = auth.uid()`), igual que ya pasaba
--     con las sorpresas desde 034. Los datos antiguos NO se borran: las
--     personas creadas por la otra cuenta simplemente dejan de ser
--     visibles para ti.
--   · Un regalo solo puede apuntar a una persona del propio usuario (se
--     valida en las políticas de INSERT/UPDATE, no solo en la interfaz).
--   · Nuevos campos del organizador: ocasión, tienda, precio real,
--     prioridad, enlaces extra, notas y archivado. Todos opcionales y
--     compatibles con las filas guardadas.
--   · Gustos e intereses y fechas propias de cada persona.
--   · Presupuesto mensual por usuario en `tamp_gift_settings`.
--
-- Es idempotente. Sin esta migración la pantalla funciona con los campos
-- de 035/037/038 y esconde los nuevos (ocasión, tienda, precio real,
-- presupuesto…).
-- ==========================================

BEGIN;

-- ------------------------------------------
-- Personas: campos nuevos del organizador
-- ------------------------------------------
ALTER TABLE public.tamp_people
  ADD COLUMN IF NOT EXISTS likes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interests text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS important_dates jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.tamp_people DROP CONSTRAINT IF EXISTS tamp_people_likes_length;
ALTER TABLE public.tamp_people ADD CONSTRAINT tamp_people_likes_length
  CHECK (length(likes) <= 2000);

ALTER TABLE public.tamp_people DROP CONSTRAINT IF EXISTS tamp_people_interests_length;
ALTER TABLE public.tamp_people ADD CONSTRAINT tamp_people_interests_length
  CHECK (length(interests) <= 2000);

ALTER TABLE public.tamp_people DROP CONSTRAINT IF EXISTS tamp_people_dates_array;
ALTER TABLE public.tamp_people ADD CONSTRAINT tamp_people_dates_array
  CHECK (jsonb_typeof(important_dates) = 'array');

GRANT INSERT (likes, interests, important_dates) ON TABLE public.tamp_people TO authenticated;
GRANT UPDATE (likes, interests, important_dates) ON TABLE public.tamp_people TO authenticated;

-- ------------------------------------------
-- Personas: aislamiento estricto por usuario
-- Antes (038) los dos miembros de la pareja leían toda la tabla.
-- ------------------------------------------
DROP POLICY IF EXISTS tamp_people_read ON public.tamp_people;
CREATE POLICY tamp_people_read ON public.tamp_people FOR SELECT TO authenticated USING (
  public.is_enabled()
  AND couple_id = public.current_couple_id()
  AND author_id = auth.uid()
  AND (removed_at IS NULL OR removed_at > now() - interval '30 days')
);

-- ------------------------------------------
-- Regalos: campos nuevos del organizador
-- ------------------------------------------
ALTER TABLE public.tamp_entries
  ADD COLUMN IF NOT EXISTS occasion text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS store text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actual_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS extra_links text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_gift_text_lengths;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_gift_text_lengths
  CHECK (
    length(occasion) <= 80
    AND length(store) <= 120
    AND length(extra_links) <= 2000
    AND length(notes) <= 4000
  );

ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_actual_price_range;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_actual_price_range
  CHECK (actual_price IS NULL OR (actual_price >= 0 AND actual_price <= 100000));

ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_priority_values;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_priority_values
  CHECK (priority IN ('', 'baja', 'media', 'alta'));

-- Los campos nuevos son de una sorpresa, nunca de un evento compartido.
ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_organizer_surprise;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_organizer_surprise
  CHECK (
    kind = 'surprise'
    OR (
      occasion = '' AND store = '' AND actual_price IS NULL
      AND priority = '' AND extra_links = '' AND notes = '' AND archived_at IS NULL
    )
  );

GRANT INSERT (occasion, store, actual_price, priority, extra_links, notes, archived_at)
  ON TABLE public.tamp_entries TO authenticated;
GRANT UPDATE (occasion, store, actual_price, priority, extra_links, notes, archived_at)
  ON TABLE public.tamp_entries TO authenticated;

-- ------------------------------------------
-- Regalos: la persona asignada tiene que ser del mismo usuario
-- La interfaz ya no ofrece ajenas; esto lo garantiza en la base.
-- ------------------------------------------
DROP POLICY IF EXISTS tamp_entries_add ON public.tamp_entries;
CREATE POLICY tamp_entries_add ON public.tamp_entries FOR INSERT TO authenticated WITH CHECK (
  public.is_enabled()
  AND couple_id = public.current_couple_id()
  AND author_id = auth.uid()
  AND (kind <> 'event' OR public.is_admin())
  AND (
    person_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tamp_people p
      WHERE p.id = tamp_entries.person_id
        AND p.author_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS tamp_entries_edit ON public.tamp_entries;
CREATE POLICY tamp_entries_edit ON public.tamp_entries FOR UPDATE TO authenticated USING (
  public.is_enabled()
  AND couple_id = public.current_couple_id()
  AND (removed_at IS NULL OR removed_at > now() - interval '30 days')
  AND (CASE WHEN kind = 'event' THEN public.is_admin() ELSE author_id = auth.uid() END)
) WITH CHECK (
  public.is_enabled()
  AND couple_id = public.current_couple_id()
  AND (CASE WHEN kind = 'event' THEN public.is_admin() ELSE author_id = auth.uid() END)
  AND (
    person_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tamp_people p
      WHERE p.id = tamp_entries.person_id
        AND p.author_id = auth.uid()
    )
  )
);

-- Borrado definitivo (solo el autor, solo sus sorpresas). La papelera
-- sigue siendo lógica; esto es el «eliminar para siempre» explícito.
DROP POLICY IF EXISTS tamp_entries_purge ON public.tamp_entries;
CREATE POLICY tamp_entries_purge ON public.tamp_entries FOR DELETE TO authenticated USING (
  public.is_enabled() AND kind = 'surprise' AND author_id = auth.uid()
);
GRANT DELETE ON public.tamp_entries TO authenticated;

-- ------------------------------------------
-- Presupuesto mensual, por usuario
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.tamp_gift_settings (
  author_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  monthly_budget numeric(10, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tamp_gift_settings_budget_range
    CHECK (monthly_budget IS NULL OR (monthly_budget >= 0 AND monthly_budget <= 100000))
);

ALTER TABLE public.tamp_gift_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tamp_gift_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tamp_gift_settings TO authenticated;
GRANT INSERT (author_id, monthly_budget) ON public.tamp_gift_settings TO authenticated;
GRANT UPDATE (monthly_budget) ON public.tamp_gift_settings TO authenticated;
GRANT ALL ON public.tamp_gift_settings TO service_role;

DROP POLICY IF EXISTS tamp_gift_settings_read ON public.tamp_gift_settings;
CREATE POLICY tamp_gift_settings_read ON public.tamp_gift_settings FOR SELECT TO authenticated USING (
  public.is_enabled() AND author_id = auth.uid()
);

DROP POLICY IF EXISTS tamp_gift_settings_add ON public.tamp_gift_settings;
CREATE POLICY tamp_gift_settings_add ON public.tamp_gift_settings FOR INSERT TO authenticated WITH CHECK (
  public.is_enabled() AND author_id = auth.uid()
);

DROP POLICY IF EXISTS tamp_gift_settings_edit ON public.tamp_gift_settings;
CREATE POLICY tamp_gift_settings_edit ON public.tamp_gift_settings FOR UPDATE TO authenticated USING (
  public.is_enabled() AND author_id = auth.uid()
) WITH CHECK (
  public.is_enabled() AND author_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.tamp_gift_settings_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tamp_gift_settings_timestamp ON public.tamp_gift_settings;
CREATE TRIGGER tamp_gift_settings_timestamp BEFORE UPDATE ON public.tamp_gift_settings
  FOR EACH ROW EXECUTE FUNCTION public.tamp_gift_settings_timestamp();

COMMIT;

-- ==========================================
-- ROLLBACK (no borra datos; solo deja de aislar personas y de exponer
-- los campos nuevos a la app)
--
-- BEGIN;
-- DROP TRIGGER IF EXISTS tamp_gift_settings_timestamp ON public.tamp_gift_settings;
-- DROP FUNCTION IF EXISTS public.tamp_gift_settings_timestamp();
-- DROP TABLE IF EXISTS public.tamp_gift_settings;
-- DROP POLICY IF EXISTS tamp_entries_purge ON public.tamp_entries;
-- REVOKE DELETE ON public.tamp_entries FROM authenticated;
-- DROP POLICY IF EXISTS tamp_people_read ON public.tamp_people;
-- CREATE POLICY tamp_people_read ON public.tamp_people FOR SELECT TO authenticated USING (
--   public.is_enabled() AND couple_id = public.current_couple_id()
--   AND (removed_at IS NULL OR removed_at > now() - interval '30 days'));
-- COMMIT;
-- ==========================================
