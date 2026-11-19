-- 029_PAREJA_UBICACION.SQL
-- Ubicación compartida de una pareja: reemplaza las dos filas asimétricas
-- (`content.location_admin` y `user_progress.location`) sin exponer datos
-- entre parejas. Aplicar después de crear la pareja en couple_members.

CREATE TABLE IF NOT EXISTS public.couples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.couple_members (
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_id, user_id),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.couple_locations (
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  location_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (couple_id, user_id)
);

CREATE INDEX IF NOT EXISTS couple_locations_sent_at_idx ON public.couple_locations(couple_id, sent_at DESC);

ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_locations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_couple_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT couple_id FROM public.couple_members WHERE user_id = auth.uid() LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_couple_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_couple_id() TO authenticated, service_role;

DROP POLICY IF EXISTS couples_select_member ON public.couples;
CREATE POLICY couples_select_member ON public.couples FOR SELECT TO authenticated
  USING (id = public.current_couple_id());

DROP POLICY IF EXISTS couple_members_select_member ON public.couple_members;
CREATE POLICY couple_members_select_member ON public.couple_members FOR SELECT TO authenticated
  USING (couple_id = public.current_couple_id());

DROP POLICY IF EXISTS couple_locations_select_member ON public.couple_locations;
CREATE POLICY couple_locations_select_member ON public.couple_locations FOR SELECT TO authenticated
  USING (public.is_enabled() AND couple_id = public.current_couple_id());

DROP POLICY IF EXISTS couple_locations_insert_self ON public.couple_locations;
CREATE POLICY couple_locations_insert_self ON public.couple_locations FOR INSERT TO authenticated
  WITH CHECK (public.is_enabled() AND couple_id = public.current_couple_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS couple_locations_update_self ON public.couple_locations;
CREATE POLICY couple_locations_update_self ON public.couple_locations FOR UPDATE TO authenticated
  USING (public.is_enabled() AND couple_id = public.current_couple_id() AND user_id = auth.uid())
  WITH CHECK (public.is_enabled() AND couple_id = public.current_couple_id() AND user_id = auth.uid());

-- Alta controlada: ejecutar una vez con service_role/SQL Editor, sustituyendo
-- los UUID. Ningún cliente puede añadir una tercera persona.
-- INSERT INTO public.couples DEFAULT VALUES RETURNING id;
-- INSERT INTO public.couple_members(couple_id, user_id) VALUES
--   ('COUPLE_UUID', 'USER_A_UUID'), ('COUPLE_UUID', 'USER_B_UUID');
