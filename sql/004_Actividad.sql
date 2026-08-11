-- ==========================================
-- 004_ACTIVIDAD.SQL — Activity log + analítica + acciones admin
-- ==========================================

-- ==========================================
-- 3. ACTIVITY_LOG — Registro de actividad
--    REGLA: cualquiera autenticado puede registrar; SOLO admin lee
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT DEFAULT '',
  details TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT DEFAULT ''
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON activity_log FROM anon;
GRANT ALL ON activity_log TO authenticated;

DROP POLICY IF EXISTS "activity_log_insert_all" ON activity_log;
DROP POLICY IF EXISTS "activity_log_select_all" ON activity_log;
DROP POLICY IF EXISTS "activity_log_select_admin" ON activity_log;
CREATE POLICY "activity_log_insert_all" ON activity_log FOR INSERT WITH CHECK (true);
CREATE POLICY "activity_log_select_admin" ON activity_log FOR SELECT USING (public.is_admin());

-- ==========================================
-- 7. ANALYTICS_VISITS — Registro de visitas
--    REGLA: cualquiera autenticado registra; SOLO admin lee
-- ==========================================
CREATE TABLE IF NOT EXISTS analytics_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT DEFAULT '',
  page TEXT DEFAULT '',
  session_id TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT DEFAULT ''
);

ALTER TABLE analytics_visits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON analytics_visits FROM anon;
GRANT ALL ON analytics_visits TO authenticated;

DROP POLICY IF EXISTS "analytics_visits_insert_all" ON analytics_visits;
DROP POLICY IF EXISTS "analytics_visits_select_all" ON analytics_visits;
DROP POLICY IF EXISTS "analytics_visits_select_admin" ON analytics_visits;
CREATE POLICY "analytics_visits_insert_all" ON analytics_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_visits_select_admin" ON analytics_visits FOR SELECT USING (public.is_admin());

-- ==========================================
-- 8. ANALYTICS_EVENTS — Eventos de analítica
--    REGLA: cualquiera autenticado registra; SOLO admin lee
-- ==========================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT DEFAULT '',
  category TEXT DEFAULT '',
  action TEXT DEFAULT '',
  label TEXT DEFAULT '',
  page TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON analytics_events FROM anon;
GRANT ALL ON analytics_events TO authenticated;

DROP POLICY IF EXISTS "analytics_events_insert_all" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_select_all" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_select_admin" ON analytics_events;
CREATE POLICY "analytics_events_insert_all" ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_events_select_admin" ON analytics_events FOR SELECT USING (public.is_admin());

-- ==========================================
-- 9. ADMIN_ACTIONS — Trazabilidad de acciones de administración
--    REGLA: SOLO admin puede insertar y leer
-- ==========================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT DEFAULT '',
  action TEXT DEFAULT '',
  details TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON admin_actions FROM anon;
GRANT ALL ON admin_actions TO authenticated;

DROP POLICY IF EXISTS "admin_actions_insert_all" ON admin_actions;
DROP POLICY IF EXISTS "admin_actions_select_all" ON admin_actions;
DROP POLICY IF EXISTS "admin_actions_insert_admin" ON admin_actions;
DROP POLICY IF EXISTS "admin_actions_select_admin" ON admin_actions;
CREATE POLICY "admin_actions_insert_admin" ON admin_actions FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "admin_actions_select_admin" ON admin_actions FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_visits_timestamp ON analytics_visits(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON admin_actions(timestamp DESC);
