-- ==========================================
-- 048_CHECKIN_SUENO.SQL
-- Check-in diario de sueño dentro del calendario menstrual.
-- La valoración solo se comparte si la dueña elige sleep_quality en
-- Menstruación → Ajustes → Compartir. El RPC nunca devuelve el marcador
-- de «Ahora no» ni la calidad si ese campo no está autorizado.
-- ==========================================

ALTER TABLE public.cycle_daily_logs
  ADD COLUMN IF NOT EXISTS sleep_prompt_completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.cycle_daily_logs.sleep_prompt_completed IS
  'Control interno del check-in diario de sueño; no se expone al resumen de pareja.';

ALTER TABLE public.cycle_sharing
  DROP CONSTRAINT IF EXISTS cycle_sharing_fields;

ALTER TABLE public.cycle_sharing
  ADD CONSTRAINT cycle_sharing_fields CHECK (
    shared_fields <@ ARRAY[
      'next_period', 'cycle_status', 'cycle_day',
      'period', 'symptoms', 'mood', 'sleep_quality', 'notes', 'stats'
    ]::text[]
  );

CREATE OR REPLACE FUNCTION public.cycle_partner_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_sharing public.cycle_sharing;
  v_fields TEXT[];
  v_settings JSONB := NULL;
  v_periods JSONB := NULL;
  v_logs JSONB := NULL;
  v_stats JSONB := NULL;
BEGIN
  IF v_me IS NULL OR NOT public.is_enabled() THEN
    RETURN jsonb_build_object('shared', FALSE);
  END IF;

  SELECT * INTO v_sharing
    FROM public.cycle_sharing
   WHERE partner_id = v_me
     AND sharing_enabled = TRUE
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('shared', FALSE);
  END IF;

  v_fields := COALESCE(v_sharing.shared_fields, '{}'::TEXT[]);

  IF v_fields && ARRAY['next_period', 'cycle_status', 'cycle_day', 'stats']::TEXT[] THEN
    SELECT jsonb_build_object(
             'avg_cycle_length', s.avg_cycle_length,
             'avg_period_length', s.avg_period_length,
             'luteal_phase_length', s.luteal_phase_length
           )
      INTO v_settings
      FROM public.cycle_settings s
     WHERE s.user_id = v_sharing.owner_id;

    SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'start_date') DESC), '[]'::JSONB)
      INTO v_periods
      FROM (
        SELECT jsonb_build_object(
                 'start_date', p.start_date,
                 'end_date', p.end_date
               ) AS item
          FROM public.cycle_periods p
         WHERE p.user_id = v_sharing.owner_id
         ORDER BY p.start_date DESC
         LIMIT 8
      ) sub;

    IF jsonb_array_length(v_periods) = 0 THEN
      v_periods := '[]'::JSONB;
    END IF;
  END IF;

  IF v_fields && ARRAY['symptoms', 'mood', 'notes', 'period', 'sleep_quality']::TEXT[] THEN
    SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'log_date') DESC), '[]'::JSONB)
      INTO v_logs
      FROM (
        SELECT jsonb_build_object(
                 'log_date', l.log_date,
                 'symptoms', CASE WHEN 'symptoms' = ANY(v_fields) THEN to_jsonb(l.symptoms) ELSE '[]'::JSONB END,
                 'mood', CASE WHEN 'mood' = ANY(v_fields) THEN to_jsonb(l.mood) ELSE '[]'::JSONB END,
                 'notes', CASE WHEN 'notes' = ANY(v_fields) THEN to_jsonb(l.notes) ELSE '""'::JSONB END,
                 'flow', CASE WHEN 'period' = ANY(v_fields) THEN to_jsonb(l.flow) ELSE 'null'::JSONB END,
                 'spotting', CASE WHEN 'period' = ANY(v_fields) THEN to_jsonb(l.spotting) ELSE 'false'::JSONB END,
                 'sleep_quality', CASE WHEN 'sleep_quality' = ANY(v_fields) THEN to_jsonb(l.sleep_quality) ELSE 'null'::JSONB END
               ) AS item
          FROM public.cycle_daily_logs l
         WHERE l.user_id = v_sharing.owner_id
           AND l.log_date >= (CURRENT_DATE - INTERVAL '120 days')
           AND (
             ('symptoms' = ANY(v_fields) AND cardinality(l.symptoms) > 0) OR
             ('mood' = ANY(v_fields) AND cardinality(l.mood) > 0) OR
             ('notes' = ANY(v_fields) AND l.notes <> '') OR
             ('period' = ANY(v_fields) AND (l.flow IS NOT NULL OR l.spotting)) OR
             ('sleep_quality' = ANY(v_fields) AND l.sleep_quality IS NOT NULL)
           )
         ORDER BY l.log_date DESC
         LIMIT 120
      ) sub;
  END IF;

  IF 'stats' = ANY(v_fields) AND v_periods IS NOT NULL THEN
    SELECT jsonb_build_object(
             'periods', (SELECT count(*) FROM public.cycle_periods p WHERE p.user_id = v_sharing.owner_id),
             'avg_cycle_length', COALESCE(v_settings->>'avg_cycle_length', NULL),
             'avg_period_length', COALESCE(v_settings->>'avg_period_length', NULL)
           )
      INTO v_stats;
  END IF;

  RETURN jsonb_build_object(
    'shared', TRUE,
    'fields', to_jsonb(v_fields),
    'support_message', v_sharing.support_message,
    'settings', v_settings,
    'periods', v_periods,
    'logs', v_logs,
    'stats', v_stats,
    'updated_at', v_sharing.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cycle_partner_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cycle_partner_snapshot() FROM anon;
GRANT EXECUTE ON FUNCTION public.cycle_partner_snapshot() TO authenticated, service_role;
