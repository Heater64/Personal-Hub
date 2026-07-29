-- ==========================================
-- PERSONAL HUB — Esquema Completo de Supabase
-- Pega TODO esto en el SQL Editor y ejecútalo UNA sola vez
-- ==========================================

-- ==========================================
-- CONCESIÓN DE PERMISOS BASE (necesario para que la API anon funcione)
-- ==========================================
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ==========================================
-- 1. CONTENT — Toda la config (razones, canciones,
--    noticias, regalos, maldía, series, changelog)
-- ==========================================
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

GRANT ALL ON content TO anon;
GRANT ALL ON content TO authenticated;

CREATE POLICY "content_read_all" ON content FOR SELECT USING (true);
CREATE POLICY "content_write_all" ON content FOR INSERT WITH CHECK (true);
CREATE POLICY "content_update_all" ON content FOR UPDATE USING (true);
CREATE POLICY "content_delete_all" ON content FOR DELETE USING (true);

-- ==========================================
-- 2. MOODS — Estados de ánimo diarios
-- ==========================================
CREATE TABLE IF NOT EXISTS moods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  mood TEXT NOT NULL,
  label TEXT DEFAULT '',
  emoji TEXT DEFAULT '',
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE moods ENABLE ROW LEVEL SECURITY;

GRANT ALL ON moods TO anon;
GRANT ALL ON moods TO authenticated;

CREATE POLICY "moods_read_own" ON moods FOR SELECT USING (true);
CREATE POLICY "moods_insert_own" ON moods FOR INSERT WITH CHECK (true);
CREATE POLICY "moods_update_own" ON moods FOR UPDATE USING (true);

-- ==========================================
-- 3. ACTIVITY_LOG — Registro de actividad
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

GRANT ALL ON activity_log TO anon;
GRANT ALL ON activity_log TO authenticated;

CREATE POLICY "activity_log_insert_all" ON activity_log FOR INSERT WITH CHECK (true);
CREATE POLICY "activity_log_select_all" ON activity_log FOR SELECT USING (true);

-- ==========================================
-- 4. USER_PROFILES — Perfiles de usuario
-- ==========================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT DEFAULT '',
  name TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}',
  progress JSONB DEFAULT '{}'
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

GRANT ALL ON user_profiles TO anon;
GRANT ALL ON user_profiles TO authenticated;

CREATE POLICY "user_profiles_read_all" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "user_profiles_insert_all" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "user_profiles_update_all" ON user_profiles FOR UPDATE USING (true);

-- ==========================================
-- 5. USER_PROGRESS — Progreso del usuario
-- ==========================================
CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, type)
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

GRANT ALL ON user_progress TO anon;
GRANT ALL ON user_progress TO authenticated;

CREATE POLICY "user_progress_read_all" ON user_progress FOR SELECT USING (true);
CREATE POLICY "user_progress_insert_all" ON user_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "user_progress_update_all" ON user_progress FOR UPDATE USING (true);

-- ==========================================
-- 6. ANALYTICS_VISITS
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

GRANT ALL ON analytics_visits TO anon;
GRANT ALL ON analytics_visits TO authenticated;

CREATE POLICY "analytics_visits_insert_all" ON analytics_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_visits_select_all" ON analytics_visits FOR SELECT USING (true);

-- ==========================================
-- 7. ANALYTICS_EVENTS
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

GRANT ALL ON analytics_events TO anon;
GRANT ALL ON analytics_events TO authenticated;

CREATE POLICY "analytics_events_insert_all" ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_events_select_all" ON analytics_events FOR SELECT USING (true);

-- ==========================================
-- 8. ADMIN_ACTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT DEFAULT '',
  action TEXT DEFAULT '',
  details TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON admin_actions TO anon;
GRANT ALL ON admin_actions TO authenticated;

CREATE POLICY "admin_actions_insert_all" ON admin_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_actions_select_all" ON admin_actions FOR SELECT USING (true);

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_moods_user_date ON moods(user_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_visits_timestamp ON analytics_visits(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON admin_actions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);

-- ==========================================
-- DATOS INICIALES
-- ==========================================
INSERT INTO content (id, data, updated_at) VALUES
  ('razones', '{"reasons": ["Por tu sonrisa", "Por como me miras", "Por ser tu"]}', NOW()),
  ('canciones', '{"songs": [{"title": "Cancion de ejemplo", "artist": "Artista"}]}', NOW()),
  ('noticias', '{"news": [{"title": "Bienvenida!", "date": "Hoy", "description": "Personal Hub ahora usa Supabase 🎉"}]}', NOW()),
  ('gifts', '{"gifts": [], "months": {}}', NOW()),
  ('maldia_frases', '{"phrases": ["Todo va a estar bien ❤️", "Eres mas fuerte de lo que crees"]}', NOW()),
  ('maldia_mensajes', '{"messages": ["Recuerda lo mucho que te quiero", "Siempre estare aqui para ti"]}', NOW()),
  ('changelog', '{"items": ["Migracion completa a Supabase - adios Firebase!"]}', NOW()),
  ('series', '{"items": []}', NOW())
ON CONFLICT (id) DO NOTHING;
