-- Sitios que comparten los dos miembros de una pareja y avisos de llegada.
-- Los clientes gestionan los lugares mediante RLS; solo la API valida
-- transiciones de geocerca y administra la cola de notificaciones.

CREATE TABLE IF NOT EXISTS public.couple_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 48),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  radius_m INTEGER NOT NULL DEFAULT 150 CHECK (radius_m BETWEEN 10 AND 1000),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (couple_id, id)
);

ALTER TABLE public.couple_places DROP CONSTRAINT IF EXISTS couple_places_radius_m_check;
ALTER TABLE public.couple_places ADD CONSTRAINT couple_places_radius_m_check CHECK (radius_m BETWEEN 10 AND 1000);

CREATE INDEX IF NOT EXISTS couple_places_active_idx
  ON public.couple_places (couple_id, created_at) WHERE enabled;

ALTER TABLE public.couple_places ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couple_places TO authenticated;
GRANT SELECT ON public.couple_places TO service_role;

DROP POLICY IF EXISTS couple_places_member_manage ON public.couple_places;
DROP POLICY IF EXISTS couple_places_member_read ON public.couple_places;
DROP POLICY IF EXISTS couple_places_member_insert ON public.couple_places;
DROP POLICY IF EXISTS couple_places_member_update ON public.couple_places;
DROP POLICY IF EXISTS couple_places_member_delete ON public.couple_places;
CREATE POLICY couple_places_member_read ON public.couple_places
  FOR SELECT TO authenticated
  USING (public.is_enabled() AND couple_id = public.current_couple_id());
CREATE POLICY couple_places_member_insert ON public.couple_places
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_enabled()
    AND couple_id = public.current_couple_id()
    AND created_by = auth.uid()
  );
CREATE POLICY couple_places_member_update ON public.couple_places
  FOR UPDATE TO authenticated
  USING (public.is_enabled() AND couple_id = public.current_couple_id())
  WITH CHECK (public.is_enabled() AND couple_id = public.current_couple_id());
CREATE POLICY couple_places_member_delete ON public.couple_places
  FOR DELETE TO authenticated
  USING (public.is_enabled() AND couple_id = public.current_couple_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_places;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.couple_place_presence (
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  place_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_inside BOOLEAN NOT NULL DEFAULT FALSE,
  last_location_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, user_id),
  FOREIGN KEY (couple_id, place_id)
    REFERENCES public.couple_places(couple_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.couple_place_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  place_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'arrival' CHECK (event_type IN ('arrival', 'departure')),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  FOREIGN KEY (couple_id, place_id)
    REFERENCES public.couple_places(couple_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS couple_place_events_pending_idx
  ON public.couple_place_events (user_id, created_at)
  WHERE delivered_at IS NULL;

ALTER TABLE public.couple_place_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_place_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.couple_place_presence, public.couple_place_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.couple_place_presence, public.couple_place_events TO service_role;

CREATE OR REPLACE FUNCTION public.claim_couple_place_entries(
  p_user_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy_m INTEGER,
  p_location_at TIMESTAMPTZ
)
RETURNS TABLE (event_id UUID, place_id UUID, place_name TEXT, occurred_at TIMESTAMPTZ, event_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_couple_id UUID;
  v_place RECORD;
  v_old_inside BOOLEAN;
  v_old_at TIMESTAMPTZ;
  v_had_state BOOLEAN;
  v_distance_m DOUBLE PRECISION;
  v_inside BOOLEAN;
  v_margin_m INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_location_at IS NULL
    OR p_latitude NOT BETWEEN -90 AND 90
    OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'invalid location';
  END IF;

  SELECT cm.couple_id INTO v_couple_id
  FROM public.couple_members AS cm
  WHERE cm.user_id = p_user_id;
  IF v_couple_id IS NULL THEN RETURN; END IF;

  -- Serializa actualizaciones simultáneas de los dos procesos del mismo móvil.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));

  FOR v_place IN
    SELECT cp.id, cp.name, cp.latitude, cp.longitude, cp.radius_m
    FROM public.couple_places AS cp
    WHERE cp.couple_id = v_couple_id AND cp.enabled
  LOOP
    SELECT state.is_inside, state.last_location_at
      INTO v_old_inside, v_old_at
      FROM public.couple_place_presence AS state
      WHERE state.place_id = v_place.id AND state.user_id = p_user_id
      FOR UPDATE;
    v_had_state := FOUND;
    IF v_had_state AND v_old_at IS NOT NULL AND v_old_at >= p_location_at THEN
      CONTINUE;
    END IF;

    v_distance_m := 2 * 6371000 * asin(sqrt(LEAST(1,
      power(sin(radians(p_latitude - v_place.latitude) / 2), 2)
      + cos(radians(v_place.latitude)) * cos(radians(p_latitude))
      * power(sin(radians(p_longitude - v_place.longitude) / 2), 2)
    )));
    v_margin_m := LEAST(100, GREATEST(30, COALESCE(p_accuracy_m, 0)));
    v_inside := v_distance_m <= v_place.radius_m
      + CASE WHEN COALESCE(v_old_inside, FALSE) THEN v_margin_m ELSE LEAST(v_place.radius_m, v_margin_m) END;

    INSERT INTO public.couple_place_presence
      (couple_id, place_id, user_id, is_inside, last_location_at, updated_at)
    VALUES (v_couple_id, v_place.id, p_user_id, v_inside, p_location_at, now())
    ON CONFLICT ON CONSTRAINT couple_place_presence_pkey DO UPDATE SET
      is_inside = EXCLUDED.is_inside,
      last_location_at = EXCLUDED.last_location_at,
      updated_at = now();

    IF v_inside AND NOT COALESCE(v_old_inside, FALSE) THEN
      INSERT INTO public.couple_place_events (couple_id, place_id, user_id, event_type, occurred_at)
      VALUES (v_couple_id, v_place.id, p_user_id, 'arrival', p_location_at);
    ELSIF NOT v_inside AND COALESCE(v_old_inside, FALSE) THEN
      INSERT INTO public.couple_place_events (couple_id, place_id, user_id, event_type, occurred_at)
      VALUES (v_couple_id, v_place.id, p_user_id, 'departure', p_location_at);
    END IF;
  END LOOP;

  -- Reintenta avisos sin entrega y reserva cada evento para impedir que dos
  -- peticiones concurrentes manden la misma notificación a la vez.
  RETURN QUERY
    UPDATE public.couple_place_events AS event
    SET claimed_at = now()
    WHERE event.user_id = p_user_id
      AND event.delivered_at IS NULL
      AND (event.claimed_at IS NULL OR event.claimed_at < now() - INTERVAL '2 minutes')
    RETURNING event.id, event.place_id,
      (SELECT cp.name FROM public.couple_places AS cp WHERE cp.id = event.place_id),
      event.occurred_at, event.event_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_couple_place_entries(p_event_ids UUID[], p_delivered BOOLEAN)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
  UPDATE public.couple_place_events AS event
  SET delivered_at = CASE WHEN p_delivered THEN now() ELSE NULL END,
      claimed_at = NULL
  WHERE event.id = ANY(COALESCE(p_event_ids, ARRAY[]::UUID[]))
    AND event.delivered_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.claim_couple_place_entries(UUID, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_couple_place_entries(UUID[], BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_couple_place_entries(UUID, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_couple_place_entries(UUID[], BOOLEAN) TO service_role;
