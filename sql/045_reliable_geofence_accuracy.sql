-- Require reliable GPS fixes for place transitions. A noisy fix must not tell
-- the partner that someone arrived or left; later accurate fixes can retry.

CREATE OR REPLACE FUNCTION public.claim_couple_place_entries(
  p_user_id UUID,
  p_couple_id UUID,
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
  IF p_user_id IS NULL OR p_couple_id IS NULL OR p_location_at IS NULL
    OR p_latitude NOT BETWEEN -90 AND 90
    OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'invalid location';
  END IF;

  SELECT cm.couple_id INTO v_couple_id
  FROM public.couple_members AS cm
  WHERE cm.user_id = p_user_id;
  IF v_couple_id IS NULL OR v_couple_id <> p_couple_id THEN RETURN; END IF;

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
    -- Missing or >100 m accuracy cannot reliably distinguish a transition.
    -- Leave presence untouched so the next accurate fix can decide it.
    IF p_accuracy_m IS NULL OR p_accuracy_m < 0 OR p_accuracy_m > 100 THEN
      CONTINUE;
    END IF;

    v_distance_m := 2 * 6371000 * asin(sqrt(LEAST(1,
      power(sin(radians(p_latitude - v_place.latitude) / 2), 2)
      + cos(radians(v_place.latitude)) * cos(radians(p_latitude))
      * power(sin(radians(p_longitude - v_place.longitude) / 2), 2)
    )));
    v_margin_m := LEAST(100, GREATEST(30, p_accuracy_m));
    -- Enter only when the full reported accuracy circle fits inside the site;
    -- retain the existing hysteresis on exit to avoid GPS jitter duplicates.
    v_inside := CASE WHEN COALESCE(v_old_inside, FALSE)
      THEN v_distance_m <= v_place.radius_m + v_margin_m
      ELSE v_distance_m + p_accuracy_m <= v_place.radius_m
    END;

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

  RETURN QUERY
    UPDATE public.couple_place_events AS event
    SET claimed_at = now()
    WHERE event.user_id = p_user_id
      AND event.couple_id = v_couple_id
      AND event.delivered_at IS NULL
      AND (event.claimed_at IS NULL OR event.claimed_at < now() - INTERVAL '2 minutes')
    RETURNING event.id, event.place_id,
      (SELECT cp.name FROM public.couple_places AS cp WHERE cp.id = event.place_id),
      event.occurred_at, event.event_type;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_couple_place_entries(
  UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_couple_place_entries(
  UUID, UUID, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TIMESTAMPTZ
) TO service_role;
