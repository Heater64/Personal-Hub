-- ==========================================
-- 027_CICLO_MENSTRUAL.SQL — Seguimiento menstrual (Sentimientos)
--
-- REGLA DE ORO: esto es información sanitaria sensible. Por eso se
-- aparta a propósito del patrón de `moods` en dos puntos:
--
--   1. NO hay bypass de `is_admin()`. El admin no lee estos datos si
--      ella no los comparte. Que sea el administrador de la app no le
--      da acceso al cuerpo de otra persona.
--   2. La pareja NO puede hacer SELECT sobre las tablas base. Solo
--      recibe el resumen que autoriza la propia dueña, a través de la
--      función `cycle_partner_snapshot()` (SECURITY DEFINER), que
--      construye el JSON campo a campo según `shared_fields`.
--
-- Consecuencia: no hay forma de leer datos ajenos «por conocer un id».
-- Revocar el acceso (sharing_enabled = false) surte efecto en la
-- siguiente llamada.
--
-- Idempotente: se puede volver a ejecutar sin romper nada.
-- Reversión: DROP TABLE public.cycle_sharing, cycle_daily_logs,
--            cycle_periods, cycle_settings;
-- ==========================================

-- ==========================================
-- 1 · TABLAS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.cycle_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avg_cycle_length SMALLINT NOT NULL DEFAULT 28
    CHECK (avg_cycle_length BETWEEN 15 AND 90),
  avg_period_length SMALLINT NOT NULL DEFAULT 5
    CHECK (avg_period_length BETWEEN 1 AND 15),
  luteal_phase_length SMALLINT NOT NULL DEFAULT 14
    CHECK (luteal_phase_length BETWEEN 7 AND 20),
  -- { daily: bool, dailyTime: 'HH:MM', period: bool }
  notifications JSONB NOT NULL DEFAULT '{"daily":false,"dailyTime":"20:00","period":false}'::jsonb,
  -- { showFertile: bool, showOvulation: bool }
  preferences JSONB NOT NULL DEFAULT '{"showFertile":true,"showOvulation":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cycle_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  is_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cycle_periods_range CHECK (end_date IS NULL OR end_date >= start_date),
  -- Un inicio por día: registrar dos veces el mismo día no crea filas gemelas.
  CONSTRAINT cycle_periods_unique_start UNIQUE (user_id, start_date)
);

CREATE TABLE IF NOT EXISTS public.cycle_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  flow TEXT CHECK (flow IS NULL OR flow IN ('light', 'medium', 'heavy')),
  spotting BOOLEAN NOT NULL DEFAULT FALSE,
  symptoms TEXT[] NOT NULL DEFAULT '{}'::text[],
  mood TEXT[] NOT NULL DEFAULT '{}'::text[],
  energy TEXT CHECK (energy IS NULL OR energy IN ('low', 'normal', 'high')),
  sleep_quality SMALLINT CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un registro por día: guardar otra vez actualiza el mismo.
  CONSTRAINT cycle_daily_logs_unique_day UNIQUE (user_id, log_date)
);

CREATE TABLE IF NOT EXISTS public.cycle_sharing (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  shared_fields TEXT[] NOT NULL DEFAULT '{}'::text[],
  support_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cycle_sharing_distinct CHECK (partner_id <> owner_id),
  -- Allowlist cerrada: ningún campo se comparte sin estar aquí.
  CONSTRAINT cycle_sharing_fields CHECK (
    shared_fields <@ ARRAY[
      'next_period', 'cycle_status', 'cycle_day',
      'period', 'symptoms', 'mood', 'notes', 'stats'
    ]::text[]
  )
);

CREATE INDEX IF NOT EXISTS idx_cycle_periods_user_start ON public.cycle_periods(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_cycle_logs_user_date ON public.cycle_daily_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_cycle_sharing_partner ON public.cycle_sharing(partner_id);

-- ==========================================
-- 2 · RLS — cada persona, solo lo suyo
-- ==========================================

ALTER TABLE public.cycle_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_sharing ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cycle_settings FROM anon;
REVOKE ALL ON public.cycle_periods FROM anon;
REVOKE ALL ON public.cycle_daily_logs FROM anon;
REVOKE ALL ON public.cycle_sharing FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_daily_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_sharing TO authenticated;

-- service_role: la API de Vercel y los scripts de mantenimiento.
GRANT ALL ON public.cycle_settings TO service_role;
GRANT ALL ON public.cycle_periods TO service_role;
GRANT ALL ON public.cycle_daily_logs TO service_role;
GRANT ALL ON public.cycle_sharing TO service_role;

-- --- cycle_settings ---
DROP POLICY IF EXISTS "cycle_settings_select_own" ON public.cycle_settings;
CREATE POLICY "cycle_settings_select_own" ON public.cycle_settings FOR SELECT
  USING (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "cycle_settings_insert_own" ON public.cycle_settings;
CREATE POLICY "cycle_settings_insert_own" ON public.cycle_settings FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "cycle_settings_update_own" ON public.cycle_settings;
CREATE POLICY "cycle_settings_update_own" ON public.cycle_settings FOR UPDATE
  USING (public.is_enabled() AND user_id = auth.uid())
  WITH CHECK (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "cycle_settings_delete_own" ON public.cycle_settings;
CREATE POLICY "cycle_settings_delete_own" ON public.cycle_settings FOR DELETE
  USING (public.is_enabled() AND user_id = auth.uid());

-- --- cycle_periods ---
DROP POLICY IF EXISTS "cycle_periods_select_own" ON public.cycle_periods;
CREATE POLICY "cycle_periods_select_own" ON public.cycle_periods FOR SELECT
  USING (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "cycle_periods_insert_own" ON public.cycle_periods;
CREATE POLICY "cycle_periods_insert_own" ON public.cycle_periods FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "cycle_periods_update_own" ON public.cycle_periods;
CREATE POLICY "cycle_periods_update_own" ON public.cycle_periods FOR UPDATE
  USING (public.is_enabled() AND user_id = auth.uid())
  WITH CHECK (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "cycle_periods_delete_own" ON public.cycle_periods;
CREATE POLICY "cycle_periods_delete_own" ON public.cycle_periods FOR DELETE
  USING (public.is_enabled() AND user_id = auth.uid());

-- --- cycle_daily_logs ---
DROP POLICY IF EXISTS "cycle_daily_logs_select_own" ON public.cycle_daily_logs;
CREATE POLICY "cycle_daily_logs_select_own" ON public.cycle_daily_logs FOR SELECT
  USING (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "cycle_daily_logs_insert_own" ON public.cycle_daily_logs;
CREATE POLICY "cycle_daily_logs_insert_own" ON public.cycle_daily_logs FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "cycle_daily_logs_update_own" ON public.cycle_daily_logs;
CREATE POLICY "cycle_daily_logs_update_own" ON public.cycle_daily_logs FOR UPDATE
  USING (public.is_enabled() AND user_id = auth.uid())
  WITH CHECK (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "cycle_daily_logs_delete_own" ON public.cycle_daily_logs;
CREATE POLICY "cycle_daily_logs_delete_own" ON public.cycle_daily_logs FOR DELETE
  USING (public.is_enabled() AND user_id = auth.uid());

-- --- cycle_sharing (solo la dueña gestiona el permiso) ---
DROP POLICY IF EXISTS "cycle_sharing_select_own" ON public.cycle_sharing;
CREATE POLICY "cycle_sharing_select_own" ON public.cycle_sharing FOR SELECT
  USING (public.is_enabled() AND owner_id = auth.uid());

DROP POLICY IF EXISTS "cycle_sharing_insert_own" ON public.cycle_sharing;
CREATE POLICY "cycle_sharing_insert_own" ON public.cycle_sharing FOR INSERT
  WITH CHECK (public.is_enabled() AND owner_id = auth.uid());

DROP POLICY IF EXISTS "cycle_sharing_update_own" ON public.cycle_sharing;
CREATE POLICY "cycle_sharing_update_own" ON public.cycle_sharing FOR UPDATE
  USING (public.is_enabled() AND owner_id = auth.uid())
  WITH CHECK (public.is_enabled() AND owner_id = auth.uid());

DROP POLICY IF EXISTS "cycle_sharing_delete_own" ON public.cycle_sharing;
CREATE POLICY "cycle_sharing_delete_own" ON public.cycle_sharing FOR DELETE
  USING (public.is_enabled() AND owner_id = auth.uid());

-- ==========================================
-- 3 · VISTA DE PAREJA — solo el resumen autorizado
--
-- Devuelve { shared:false } cuando no hay permiso. Cuando lo hay,
-- construye el JSON campo a campo: lo que no está en shared_fields
-- no viaja, aunque la fila exista. El nivel de fila (RLS) no puede
-- ocultar columnas; esta función sí.
-- ==========================================

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

  -- Cualquier dato derivado del ciclo necesita ajustes + periodos.
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

  -- Solo si alguno de estos campos está compartido se envían registros,
  -- y cada columna se filtra por separado.
  IF v_fields && ARRAY['symptoms', 'mood', 'notes', 'period']::TEXT[] THEN
    SELECT COALESCE(jsonb_agg(item ORDER BY (item->>'log_date') DESC), '[]'::JSONB)
      INTO v_logs
      FROM (
        SELECT jsonb_build_object(
                 'log_date', l.log_date,
                 'symptoms', CASE WHEN 'symptoms' = ANY(v_fields) THEN to_jsonb(l.symptoms) ELSE '[]'::JSONB END,
                 'mood', CASE WHEN 'mood' = ANY(v_fields) THEN to_jsonb(l.mood) ELSE '[]'::JSONB END,
                 'notes', CASE WHEN 'notes' = ANY(v_fields) THEN to_jsonb(l.notes) ELSE '""'::JSONB END,
                 'flow', CASE WHEN 'period' = ANY(v_fields) THEN to_jsonb(l.flow) ELSE 'null'::JSONB END,
                 'spotting', CASE WHEN 'period' = ANY(v_fields) THEN to_jsonb(l.spotting) ELSE 'false'::JSONB END
               ) AS item
          FROM public.cycle_daily_logs l
         WHERE l.user_id = v_sharing.owner_id
           AND l.log_date >= (CURRENT_DATE - INTERVAL '120 days')
         ORDER BY l.log_date DESC
         LIMIT 120
      ) sub;
  END IF;

  -- Estadísticas: conteos agregados, sin fechas ni notas.
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

-- La otra cuenta de la casa, resuelta en el servidor. Sin esto, la cuenta
-- de ella no podría leer el id del admin (la RLS de `profiles` solo le deja
-- ver el suyo) y no podría guardar a quién autoriza.
CREATE OR REPLACE FUNCTION public.cycle_partner_candidate()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
    FROM public.profiles p
   WHERE p.id <> auth.uid()
     AND COALESCE(p.enabled, TRUE)
   ORDER BY CASE WHEN p.role = 'user' THEN 0 ELSE 1 END, p.created_at
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.cycle_partner_candidate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cycle_partner_candidate() FROM anon;
GRANT EXECUTE ON FUNCTION public.cycle_partner_candidate() TO authenticated, service_role;

-- ==========================================
-- 4 · VERIFICACIÓN (a mano, con las dos cuentas)
-- ==========================================
-- 1. Nadie más puede leer las tablas base (con la otra cuenta debe dar 0):
--
--    SELECT count(*) FROM public.cycle_periods;
--    SELECT count(*) FROM public.cycle_daily_logs;
--    SELECT count(*) FROM public.cycle_sharing;
--
-- 2. Sin compartir, la pareja recibe { shared: false }:
--
--    SELECT public.cycle_partner_snapshot();
--
-- 3. Compartiendo solo 'next_period', el JSON NO debe traer logs:
--
--    UPDATE public.cycle_sharing
--       SET sharing_enabled = TRUE, shared_fields = ARRAY['next_period'];
--    SELECT public.cycle_partner_snapshot()->>'logs';  -- debe ser null
--
-- 4. Revocar corta el acceso en la siguiente llamada:
--
--    UPDATE public.cycle_sharing SET sharing_enabled = FALSE;
--    SELECT public.cycle_partner_snapshot();           -- { shared: false }
--
-- 5. La pareja no puede modificar registros ajenos (debe fallar por RLS):
--
--    UPDATE public.cycle_periods SET notes = 'x' WHERE user_id <> auth.uid();
