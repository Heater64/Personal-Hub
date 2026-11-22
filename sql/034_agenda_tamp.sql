BEGIN;
CREATE TABLE IF NOT EXISTS public.tamp_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL DEFAULT public.current_couple_id() REFERENCES public.couples,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('event','surprise','feeling')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 140),
  detail text NOT NULL DEFAULT '' CHECK (length(detail) <= 4000),
  day date NOT NULL,
  clock time,
  place text NOT NULL DEFAULT '' CHECK (length(place) <= 200),
  frequency text NOT NULL DEFAULT 'once' CHECK (frequency IN ('once','daily','weekly','monthly','yearly')),
  until_day date CHECK (until_day >= day),
  state text NOT NULL DEFAULT 'pendiente',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  CHECK ((kind='event' AND state='pendiente') OR
    (kind='feeling' AND state IN ('pendiente','hablado','resuelto')) OR
    (kind='surprise' AND state IN ('pendiente','preparado','entregado')))
);
CREATE INDEX IF NOT EXISTS tamp_entries_calendar ON public.tamp_entries(couple_id,kind,day);
ALTER TABLE public.tamp_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tamp_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tamp_entries TO authenticated;
GRANT INSERT (id,kind,title,detail,day,clock,place,frequency,until_day,state) ON TABLE public.tamp_entries TO authenticated;
GRANT UPDATE (title,detail,day,clock,place,frequency,until_day,state,removed_at) ON TABLE public.tamp_entries TO authenticated;
GRANT ALL ON public.tamp_entries TO service_role;
DROP POLICY IF EXISTS tamp_entries_read ON public.tamp_entries;
CREATE POLICY tamp_entries_read ON public.tamp_entries FOR SELECT TO authenticated USING (
 public.is_enabled() AND couple_id=public.current_couple_id()
 AND (kind <> 'surprise' OR author_id=auth.uid())
 AND (removed_at IS NULL OR (removed_at > now()-interval '30 days' AND (author_id=auth.uid() OR (kind='event' AND public.is_admin()))))
);
DROP POLICY IF EXISTS tamp_entries_add ON public.tamp_entries;
CREATE POLICY tamp_entries_add ON public.tamp_entries FOR INSERT TO authenticated WITH CHECK (
 public.is_enabled() AND couple_id=public.current_couple_id() AND author_id=auth.uid() AND (kind <> 'event' OR public.is_admin())
);
DROP POLICY IF EXISTS tamp_entries_edit ON public.tamp_entries;
CREATE POLICY tamp_entries_edit ON public.tamp_entries FOR UPDATE TO authenticated USING (
 public.is_enabled() AND couple_id=public.current_couple_id() AND (removed_at IS NULL OR removed_at > now()-interval '30 days')
 AND (CASE WHEN kind='event' THEN public.is_admin() ELSE author_id=auth.uid() END)
) WITH CHECK (public.is_enabled() AND couple_id=public.current_couple_id() AND (CASE WHEN kind='event' THEN public.is_admin() ELSE author_id=auth.uid() END));
CREATE OR REPLACE FUNCTION public.tamp_entry_timestamp() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.updated_at=clock_timestamp();
 IF OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL THEN NEW.removed_at=now();
 ELSIF OLD.removed_at IS NOT NULL AND NEW.removed_at IS NOT NULL THEN NEW.removed_at=OLD.removed_at;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tamp_entry_timestamp ON public.tamp_entries;
CREATE TRIGGER tamp_entry_timestamp BEFORE UPDATE ON public.tamp_entries FOR EACH ROW EXECUTE FUNCTION public.tamp_entry_timestamp();
COMMIT;
