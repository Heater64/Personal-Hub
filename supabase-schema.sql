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

DROP POLICY IF EXISTS "content_read_all" ON content;
DROP POLICY IF EXISTS "content_write_all" ON content;
DROP POLICY IF EXISTS "content_update_all" ON content;
DROP POLICY IF EXISTS "content_delete_all" ON content;
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

DROP POLICY IF EXISTS "moods_read_all" ON moods;
DROP POLICY IF EXISTS "moods_insert_all" ON moods;
DROP POLICY IF EXISTS "moods_update_all" ON moods;
CREATE POLICY "moods_read_all" ON moods FOR SELECT USING (true);
CREATE POLICY "moods_insert_all" ON moods FOR INSERT WITH CHECK (true);
CREATE POLICY "moods_update_all" ON moods FOR UPDATE USING (true);

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

DROP POLICY IF EXISTS "activity_log_insert_all" ON activity_log;
DROP POLICY IF EXISTS "activity_log_select_all" ON activity_log;
CREATE POLICY "activity_log_insert_all" ON activity_log FOR INSERT WITH CHECK (true);
CREATE POLICY "activity_log_select_all" ON activity_log FOR SELECT USING (true);

-- ==========================================
-- 4. PROFILES — Perfiles de usuario (usada por la app)
-- ==========================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT DEFAULT '',
  name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  role TEXT DEFAULT 'user',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT ALL ON profiles TO anon;
GRANT ALL ON profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_all" ON profiles;
CREATE POLICY "profiles_read_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_all" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_all" ON profiles FOR UPDATE USING (true);

-- Trigger para crear perfil automáticamente al registrar un usuario.
-- Solo se dispara en INSERT para no sobrescribir cambios manuales en UPDATE.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 5. STORAGE — Bucket público para avatares
-- ==========================================
-- Crea el bucket si no existe (desde SQL no siempre es posible en todos los proyectos;
-- en ese caso, créalo desde la UI y aplica las políticas de abajo).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Permisos sobre el schema de Storage
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;

-- Políticas de Storage para el bucket 'avatars'.
-- bucket_id es el nombre del bucket (texto) en Supabase Storage.
DROP POLICY IF EXISTS "avatars_select_all" ON storage.objects;
CREATE POLICY "avatars_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Permite subir/actualizar/borrar solo dentro de su propia carpeta (user_id)
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ==========================================
-- 6. USER_PROGRESS — Progreso del usuario
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

DROP POLICY IF EXISTS "user_progress_read_all" ON user_progress;
DROP POLICY IF EXISTS "user_progress_insert_all" ON user_progress;
DROP POLICY IF EXISTS "user_progress_update_all" ON user_progress;
CREATE POLICY "user_progress_read_all" ON user_progress FOR SELECT USING (true);
CREATE POLICY "user_progress_insert_all" ON user_progress FOR INSERT WITH CHECK (true);
CREATE POLICY "user_progress_update_all" ON user_progress FOR UPDATE USING (true);

-- ==========================================
-- 7. ANALYTICS_VISITS
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

DROP POLICY IF EXISTS "analytics_visits_insert_all" ON analytics_visits;
DROP POLICY IF EXISTS "analytics_visits_select_all" ON analytics_visits;
CREATE POLICY "analytics_visits_insert_all" ON analytics_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_visits_select_all" ON analytics_visits FOR SELECT USING (true);

-- ==========================================
-- 8. ANALYTICS_EVENTS
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

DROP POLICY IF EXISTS "analytics_events_insert_all" ON analytics_events;
DROP POLICY IF EXISTS "analytics_events_select_all" ON analytics_events;
CREATE POLICY "analytics_events_insert_all" ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_events_select_all" ON analytics_events FOR SELECT USING (true);

-- ==========================================
-- 9. ADMIN_ACTIONS
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

DROP POLICY IF EXISTS "admin_actions_insert_all" ON admin_actions;
DROP POLICY IF EXISTS "admin_actions_select_all" ON admin_actions;
CREATE POLICY "admin_actions_insert_all" ON admin_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "admin_actions_select_all" ON admin_actions FOR SELECT USING (true);

-- ==========================================
-- LIMPIEZA DE TABLAS ANTIGUAS
-- ==========================================
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_moods_user_date ON moods(user_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_visits_timestamp ON analytics_visits(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_timestamp ON admin_actions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

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
