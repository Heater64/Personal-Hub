-- ==========================================
-- PERSONAL HUB — Esquema Completo de Supabase
-- Pega TODO esto en el SQL Editor y ejecútalo UNA sola vez
--
-- ⚠️ SEGURIDAD (auditoría):
--   · content: solo lectura para usuarios autenticados; escribir = ADMIN.
--   · anon NO tiene permisos de escritura en ninguna tabla de contenido.
--   · El rol admin se lee de profiles (nunca de user_metadata del cliente).
--   · Storage: galeria/memes solo escritura ADMIN; avatares carpeta propia.
-- ==========================================

-- ==========================================
-- CONCESIÓN DE PERMISOS BASE
-- ==========================================
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- service_role (API de Vercel, scripts y service key): acceso total.
-- ⚠️ Si falta este GRANT, todo lo que use la service key da 403
--    "permission denied for table …" (visto en producción: /api/users,
--    /api/push y scripts de mantenimiento fallan silenciosamente).
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ==========================================
-- MIGRACIÓN: Asegurar UUID en columnas de clave
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id' AND data_type = 'text') THEN
    ALTER TABLE public.profiles ALTER COLUMN id TYPE UUID USING NULLIF(id, '')::uuid;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'moods' AND column_name = 'user_id' AND data_type = 'text') THEN
    ALTER TABLE public.moods ALTER COLUMN user_id TYPE UUID USING NULLIF(user_id, '')::uuid;
  END IF;
END $$;

-- ==========================================
-- HELPER: verificar si el usuario actual es administrador
-- Usa SECURITY DEFINER para evitar recursión en RLS
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id::uuid = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 1. CONTENT — Toda la config (razones, canciones,
--    noticias, regalos, maldía, series, changelog)
--    REGLA: leer = autenticado · escribir = ADMIN
-- ==========================================
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- anon: SIN permisos sobre content (ni siquiera lectura pre-login)
REVOKE ALL ON content FROM anon;
GRANT SELECT ON content TO authenticated;

DROP POLICY IF EXISTS "content_read_all" ON content;
DROP POLICY IF EXISTS "content_write_all" ON content;
DROP POLICY IF EXISTS "content_update_all" ON content;
DROP POLICY IF EXISTS "content_delete_all" ON content;
DROP POLICY IF EXISTS "content_write_admin" ON content;
DROP POLICY IF EXISTS "content_update_admin" ON content;
DROP POLICY IF EXISTS "content_delete_admin" ON content;

CREATE POLICY "content_read_all" ON content FOR SELECT USING (true);
CREATE POLICY "content_write_admin" ON content FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "content_update_admin" ON content FOR UPDATE USING (public.is_admin());
CREATE POLICY "content_delete_admin" ON content FOR DELETE USING (public.is_admin());

-- Habilita Realtime en la tabla content: cuando el Admin edita cualquier
-- contenido (portadas, razones, canciones, regalos…), los usuarios lo
-- reciben al instante (postgres_changes). Idempotente: no falla si ya
-- estaba en la publicación.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.content;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- ya era miembro de la publicación
END $$;

-- ==========================================
-- 2. MOODS — Estados de ánimo diarios (datos personales)
--    REGLA: cada usuario solo su propio historial (o admin)
-- ==========================================
CREATE TABLE IF NOT EXISTS moods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  mood TEXT NOT NULL,
  label TEXT DEFAULT '',
  emoji TEXT DEFAULT '',
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migración desde el esquema anterior (UNIQUE user_id+date)
ALTER TABLE moods DROP CONSTRAINT IF EXISTS moods_user_id_date_key;

ALTER TABLE moods ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON moods FROM anon;
GRANT ALL ON moods TO authenticated;

DROP POLICY IF EXISTS "moods_read_all" ON moods;
DROP POLICY IF EXISTS "moods_insert_all" ON moods;
DROP POLICY IF EXISTS "moods_update_all" ON moods;
DROP POLICY IF EXISTS "moods_select_policy" ON moods;
DROP POLICY IF EXISTS "moods_insert_policy" ON moods;
DROP POLICY IF EXISTS "moods_update_policy" ON moods;
DROP POLICY IF EXISTS "moods_delete_policy" ON moods;

CREATE POLICY "moods_select_policy" ON moods FOR SELECT
  USING (user_id::uuid = auth.uid() OR public.is_admin());

CREATE POLICY "moods_insert_policy" ON moods FOR INSERT
  WITH CHECK (user_id::uuid = auth.uid());

CREATE POLICY "moods_update_policy" ON moods FOR UPDATE
  USING (user_id::uuid = auth.uid());

CREATE POLICY "moods_delete_policy" ON moods FOR DELETE
  USING (user_id::uuid = auth.uid() OR public.is_admin());

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
-- 4. PROFILES — Perfiles de usuario
--    REGLA: leer/editar el propio (o admin). Rol protegido por trigger.
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

REVOKE ALL ON profiles FROM anon;
GRANT ALL ON profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_read_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_all" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;

CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT
  USING (id::uuid = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_insert_policy" ON profiles FOR INSERT
  WITH CHECK (id::uuid = auth.uid());

CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE
  USING (id::uuid = auth.uid() OR public.is_admin());

-- Trigger para evitar que un usuario no-admin cambie su propio rol a admin,
-- y para evitar que el último administrador se quite su rol.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Solo los administradores pueden cambiar roles
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Solo los administradores pueden cambiar el rol.';
    END IF;

    -- Evitar que el último admin se quite su propio rol
    IF OLD.id::uuid = auth.uid()
       AND OLD.role = 'admin'
       AND NEW.role <> 'admin'
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin' AND id::uuid <> OLD.id::uuid) THEN
      RAISE EXCEPTION 'No puedes eliminar tu propio rol de administrador porque eres el último administrador.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_prevent_role_change ON public.profiles;
CREATE TRIGGER profiles_prevent_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- Trigger para crear perfil automáticamente al registrar un usuario.
-- ⚠️ NUNCA confía en user_metadata.role del cliente (es escalable vía signUp).
-- El rol se asigna por email: admin@personalhub.com → admin, cualquier otro → user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    CASE WHEN NEW.email = 'admin@personalhub.com' THEN 'admin' ELSE 'user' END,
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
-- 5. STORAGE — Buckets públicos
--    avatares:  lectura pública · escritura carpeta propia o admin
--    galeria:   lectura pública · escritura SOLO admin
--    memes:     lectura pública · escritura SOLO admin
-- ==========================================
-- Crea los buckets si no existen.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('galeria', 'galeria', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('memes', 'memes', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Permisos sobre el schema de Storage
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
-- anon: solo lectura pública · authenticated: según políticas RLS
REVOKE ALL ON storage.objects FROM anon;
REVOKE ALL ON storage.objects FROM authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;

-- Políticas de Storage
DROP POLICY IF EXISTS "avatars_select_all" ON storage.objects;
CREATE POLICY "avatars_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- galeria: lectura pública, escritura SOLO admin
DROP POLICY IF EXISTS "galeria_select_all" ON storage.objects;
CREATE POLICY "galeria_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'galeria');

DROP POLICY IF EXISTS "galeria_insert_admin" ON storage.objects;
CREATE POLICY "galeria_insert_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'galeria' AND public.is_admin());

DROP POLICY IF EXISTS "galeria_update_admin" ON storage.objects;
CREATE POLICY "galeria_update_admin"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'galeria' AND public.is_admin());

DROP POLICY IF EXISTS "galeria_delete_admin" ON storage.objects;
CREATE POLICY "galeria_delete_admin"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'galeria' AND public.is_admin());

-- memes: lectura pública, escritura SOLO admin
DROP POLICY IF EXISTS "memes_select_all" ON storage.objects;
CREATE POLICY "memes_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'memes');

DROP POLICY IF EXISTS "memes_insert_admin" ON storage.objects;
CREATE POLICY "memes_insert_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'memes' AND public.is_admin());

DROP POLICY IF EXISTS "memes_update_admin" ON storage.objects;
CREATE POLICY "memes_update_admin"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'memes' AND public.is_admin());

DROP POLICY IF EXISTS "memes_delete_admin" ON storage.objects;
CREATE POLICY "memes_delete_admin"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'memes' AND public.is_admin());

-- ==========================================
-- 6. USER_PROGRESS — Progreso del usuario (datos personales)
--    REGLA: cada usuario solo su propio progreso (o admin)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, type)
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON user_progress FROM anon;
GRANT ALL ON user_progress TO authenticated;

DROP POLICY IF EXISTS "user_progress_read_all" ON user_progress;
DROP POLICY IF EXISTS "user_progress_insert_all" ON user_progress;
DROP POLICY IF EXISTS "user_progress_update_all" ON user_progress;
DROP POLICY IF EXISTS "user_progress_select_own" ON user_progress;
DROP POLICY IF EXISTS "user_progress_insert_own" ON user_progress;
DROP POLICY IF EXISTS "user_progress_update_own" ON user_progress;
DROP POLICY IF EXISTS "user_progress_delete_own" ON user_progress;

CREATE POLICY "user_progress_select_own" ON user_progress FOR SELECT
  USING (user_id::uuid = auth.uid() OR public.is_admin());

CREATE POLICY "user_progress_insert_own" ON user_progress FOR INSERT
  WITH CHECK (user_id::uuid = auth.uid());

CREATE POLICY "user_progress_update_own" ON user_progress FOR UPDATE
  USING (user_id::uuid = auth.uid() OR public.is_admin());

CREATE POLICY "user_progress_delete_own" ON user_progress FOR DELETE
  USING (user_id::uuid = auth.uid() OR public.is_admin());

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

-- ==========================================
-- LIMPIEZA DE TABLAS ANTIGUAS
-- ==========================================
DROP TABLE IF EXISTS user_profiles CASCADE;

-- ==========================================
-- AUDITORÍA DE SEGURIDAD — corregir roles existentes
-- (cualquier perfil marcado admin sin ser el admin real vuelve a 'user';
--  el trigger se desactiva temporalmente para que la corrección funcione)
-- ==========================================
ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_role_change;

-- Crea los perfiles que falten: los usuarios de auth.users creados ANTES
-- del trigger on_auth_user_created no tienen fila en profiles. Sin ella,
-- public.is_admin() devuelve false y la RLS bloquea TODAS las escrituras
-- (content, etc.) con "new row violates row-level security policy".
INSERT INTO public.profiles (id, email, name, avatar_url, role, created_at, updated_at)
SELECT
  au.id,
  COALESCE(au.email, ''),
  COALESCE(au.raw_user_meta_data->>'name', split_part(COALESCE(au.email, ''), '@', 1), 'Usuario'),
  COALESCE(au.raw_user_meta_data->>'avatar_url', ''),
  CASE WHEN LOWER(au.email) = 'admin@personalhub.com' THEN 'admin' ELSE 'user' END,
  au.created_at,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

UPDATE public.profiles SET role = 'user'
  WHERE role = 'admin' AND LOWER(email) IS DISTINCT FROM 'admin@personalhub.com';
UPDATE public.profiles SET role = 'admin'
  WHERE LOWER(email) = 'admin@personalhub.com';
ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_role_change;

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
  ('series', '{"items": []}', NOW()),
  ('rincon_covers', '{"covers": {}}', NOW()),
  ('audios', '{"audios": []}', NOW()),
  ('openwhen_letters', '{"letters": []}', NOW())
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 10. MULTIJUGADOR — Invitaciones y salas de juegos
-- ==========================================
CREATE TABLE IF NOT EXISTS game_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL CHECK (game_id IN ('conecta4', 'tresenraya', 'battleship')),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished', 'cancelled')),
  state JSONB NOT NULL DEFAULT '{}',
  turn_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  result JSONB NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 0,
  rematch_host BOOLEAN NOT NULL DEFAULT false,
  rematch_guest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE TABLE IF NOT EXISTS game_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL CHECK (game_id IN ('conecta4', 'tresenraya', 'battleship')),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  CONSTRAINT game_invitations_not_self CHECK (inviter_id <> invitee_id)
);

-- Estado privado: especialmente importante para no revelar la flota rival.
CREATE TABLE IF NOT EXISTS game_room_players (
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_index SMALLINT NOT NULL CHECK (player_index IN (0, 1)),
  private_state JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id),
  UNIQUE (room_id, player_index)
);

ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_room_players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON game_rooms FROM anon;
REVOKE ALL ON game_rooms FROM authenticated;
REVOKE ALL ON game_invitations FROM anon;
REVOKE ALL ON game_invitations FROM authenticated;
REVOKE ALL ON game_room_players FROM anon;
REVOKE ALL ON game_room_players FROM authenticated;
GRANT SELECT ON game_rooms TO authenticated;
GRANT SELECT ON game_invitations TO authenticated;
GRANT SELECT ON game_room_players TO authenticated;

DROP POLICY IF EXISTS "game_rooms_select_participant" ON game_rooms;
CREATE POLICY "game_rooms_select_participant" ON game_rooms FOR SELECT
  USING (host_id = auth.uid() OR guest_id = auth.uid());
DROP POLICY IF EXISTS "game_invitations_select_participant" ON game_invitations;
CREATE POLICY "game_invitations_select_participant" ON game_invitations FOR SELECT
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());
DROP POLICY IF EXISTS "game_room_players_select_own" ON game_room_players;
CREATE POLICY "game_room_players_select_own" ON game_room_players FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_game_rooms_participants ON game_rooms(host_id, guest_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_room_players_user ON game_room_players(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_invitations_invitee ON game_invitations(invitee_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_invitations_pending_pair
  ON game_invitations(inviter_id, invitee_id, game_id) WHERE status = 'pending';

-- Migra salas antiguas que todavía guardaban la flota completa en state.
INSERT INTO public.game_room_players (room_id, user_id, player_index, private_state)
SELECT id, host_id, 0, jsonb_build_object(
  'board', state->'boards'->0, 'ships', state->'ships'->0, 'shots', state->'shots'->0
)
FROM public.game_rooms
WHERE game_id = 'battleship' AND host_id IS NOT NULL
  AND state ? 'boards' AND state ? 'ships'
ON CONFLICT (room_id, user_id) DO NOTHING;
INSERT INTO public.game_room_players (room_id, user_id, player_index, private_state)
SELECT id, guest_id, 1, jsonb_build_object(
  'board', state->'boards'->1, 'ships', state->'ships'->1, 'shots', state->'shots'->1
)
FROM public.game_rooms
WHERE game_id = 'battleship' AND host_id IS NOT NULL AND guest_id IS NOT NULL
  AND state ? 'boards' AND state ? 'ships'
ON CONFLICT (room_id, user_id) DO NOTHING;
UPDATE public.game_rooms r
SET state = r.state - 'boards' - 'ships'
WHERE r.game_id = 'battleship' AND r.state ? 'boards'
  AND EXISTS (SELECT 1 FROM public.game_room_players p WHERE p.room_id = r.id AND p.player_index = 0)
  AND EXISTS (SELECT 1 FROM public.game_room_players p WHERE p.room_id = r.id AND p.player_index = 1);

CREATE OR REPLACE FUNCTION public.get_game_invite_targets()
RETURNS TABLE (id UUID, name TEXT, email TEXT, avatar_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, COALESCE(NULLIF(p.name, ''), split_part(p.email, '@', 1)), p.email, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.enabled = true AND p.id <> auth.uid()
  ORDER BY p.name, p.email;
$$;

CREATE OR REPLACE FUNCTION public.create_game_invitation(
  p_game_id TEXT, p_invitee_id UUID, p_initial_state JSONB DEFAULT '{}'::jsonb
)
RETURNS game_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE target profiles%ROWTYPE; created_room game_rooms%ROWTYPE; created_invitation game_invitations%ROWTYPE; current_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;
  IF p_game_id NOT IN ('conecta4', 'tresenraya', 'battleship') THEN RAISE EXCEPTION 'Juego no disponible para multijugador.'; END IF;
  IF p_invitee_id = auth.uid() THEN RAISE EXCEPTION 'No puedes invitarte a ti mismo.'; END IF;
  SELECT * INTO target FROM public.profiles WHERE id = p_invitee_id AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese usuario no está disponible.'; END IF;
  SELECT COALESCE(NULLIF(name, ''), split_part(email, '@', 1), 'Jugador') INTO current_name
    FROM public.profiles WHERE id = auth.uid();

  -- Libera invitaciones pendientes ya caducadas para permitir una nueva
  -- invitación al mismo juego y usuario sin depender de un cron externo.
  UPDATE public.game_rooms
  SET status = 'cancelled', updated_at = NOW()
  WHERE id IN (
    SELECT room_id FROM public.game_invitations
    WHERE inviter_id = auth.uid() AND invitee_id = p_invitee_id
      AND game_id = p_game_id AND status = 'pending' AND expires_at <= NOW()
  ) AND status = 'waiting';
  UPDATE public.game_invitations
  SET status = 'expired', updated_at = NOW()
  WHERE inviter_id = auth.uid() AND invitee_id = p_invitee_id
    AND game_id = p_game_id AND status = 'pending' AND expires_at <= NOW();

  INSERT INTO public.game_rooms (game_id, host_id, state, turn_user_id)
    VALUES (
      p_game_id,
      auth.uid(),
      CASE WHEN p_game_id = 'battleship' THEN COALESCE(p_initial_state, '{}'::jsonb) - 'boards' - 'ships'
           ELSE COALESCE(p_initial_state, '{}'::jsonb) END,
      auth.uid()
    ) RETURNING * INTO created_room;

  IF p_game_id = 'battleship' THEN
    INSERT INTO public.game_room_players (room_id, user_id, player_index, private_state)
      VALUES
        (created_room.id, auth.uid(), 0, jsonb_build_object(
          'board', p_initial_state->'boards'->0,
          'ships', p_initial_state->'ships'->0,
          'shots', p_initial_state->'shots'->0
        )),
        (created_room.id, p_invitee_id, 1, jsonb_build_object(
          'board', p_initial_state->'boards'->1,
          'ships', p_initial_state->'ships'->1,
          'shots', p_initial_state->'shots'->1
        ));
  END IF;

  INSERT INTO public.game_invitations (room_id, game_id, inviter_id, invitee_id, inviter_name)
    VALUES (created_room.id, p_game_id, auth.uid(), p_invitee_id, COALESCE(current_name, 'Jugador'))
    RETURNING * INTO created_invitation;
  RETURN created_invitation;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_game_invitation(p_invitation_id UUID, p_accept BOOLEAN)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE invitation game_invitations%ROWTYPE; updated_room game_rooms%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM public.game_invitations
    WHERE id = p_invitation_id AND invitee_id = auth.uid() AND status = 'pending' AND expires_at > NOW() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La invitación ya no está disponible.'; END IF;
  UPDATE public.game_invitations SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END, updated_at = NOW()
    WHERE id = invitation.id;
  IF p_accept THEN
    UPDATE public.game_rooms SET guest_id = auth.uid(), status = 'active', expires_at = NOW() + INTERVAL '24 hours', updated_at = NOW()
      WHERE id = invitation.room_id AND status = 'waiting' RETURNING * INTO updated_room;
    IF invitation.game_id = 'battleship' AND updated_room.state ? 'boards' THEN
      INSERT INTO public.game_room_players (room_id, user_id, player_index, private_state)
        VALUES (updated_room.id, auth.uid(), 1, jsonb_build_object(
          'board', updated_room.state->'boards'->1,
          'ships', updated_room.state->'ships'->1,
          'shots', updated_room.state->'shots'->1
        )) ON CONFLICT (room_id, user_id) DO NOTHING;
      UPDATE public.game_rooms SET state = state - 'boards' - 'ships', updated_at = NOW()
        WHERE id = updated_room.id RETURNING * INTO updated_room;
    END IF;
  ELSE
    UPDATE public.game_rooms SET status = 'cancelled', updated_at = NOW()
      WHERE id = invitation.room_id RETURNING * INTO updated_room;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'La sala ya no está disponible.'; END IF;
  RETURN updated_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_game_room(p_room_id UUID)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE updated_room game_rooms%ROWTYPE;
BEGIN
  UPDATE public.game_rooms SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_room_id AND host_id = auth.uid() AND status = 'waiting'
    RETURNING * INTO updated_room;
  IF NOT FOUND THEN RAISE EXCEPTION 'La invitación ya no se puede cancelar.'; END IF;
  UPDATE public.game_invitations SET status = 'cancelled', updated_at = NOW()
    WHERE room_id = p_room_id AND status = 'pending';
  RETURN updated_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_game_player_state(p_room_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT players.private_state
  FROM public.game_room_players AS players
  JOIN public.game_rooms AS rooms ON rooms.id = players.room_id
  WHERE players.room_id = p_room_id
    AND players.user_id = auth.uid()
    AND (rooms.host_id = auth.uid() OR rooms.guest_id = auth.uid())
    AND rooms.status IN ('active', 'finished');
$$;

CREATE OR REPLACE FUNCTION public.submit_battleship_move(
  p_room_id UUID, p_row INTEGER, p_col INTEGER, p_expected_revision INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  room game_rooms%ROWTYPE;
  shooter game_room_players%ROWTYPE;
  target game_room_players%ROWTYPE;
  target_user_id UUID;
  public_state JSONB;
  shooter_state JSONB;
  target_state JSONB;
  target_board JSONB;
  next_shots JSONB;
  ship JSONB;
  cell JSONB;
  hit BOOLEAN;
  sunk BOOLEAN := false;
  found_ship BOOLEAN := false;
  ship_index INTEGER;
  ship_cell_index INTEGER;
  check_cell_index INTEGER;
  target_alive INTEGER;
  next_turn UUID;
  next_status TEXT := 'active';
  next_winner UUID := NULL;
  updated_room game_rooms%ROWTYPE;
BEGIN
  IF p_row < 0 OR p_row >= 10 OR p_col < 0 OR p_col >= 10 THEN RAISE EXCEPTION 'Coordenada no válida.'; END IF;

  SELECT * INTO room FROM public.game_rooms
    WHERE id = p_room_id AND game_id = 'battleship'
      AND (host_id = auth.uid() OR guest_id = auth.uid())
      AND status = 'active' AND expires_at > NOW()
      AND turn_user_id = auth.uid() AND revision = p_expected_revision
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La partida cambió. Sincronizando…'; END IF;

  SELECT * INTO shooter FROM public.game_room_players
    WHERE room_id = room.id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jugador no encontrado.'; END IF;

  target_user_id := CASE WHEN room.host_id = auth.uid() THEN room.guest_id ELSE room.host_id END;
  SELECT * INTO target FROM public.game_room_players
    WHERE room_id = room.id AND user_id = target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rival no encontrado.'; END IF;

  shooter_state := shooter.private_state;
  target_state := target.private_state;
  target_board := target_state->'board';
  next_shots := shooter_state->'shots';
  IF jsonb_typeof(target_board) <> 'array' OR jsonb_array_length(target_board) <> 10
     OR jsonb_typeof(next_shots) <> 'array' OR jsonb_array_length(next_shots) <> 10 THEN
    RAISE EXCEPTION 'Estado privado de flota no válido.';
  END IF;
  IF ((next_shots->p_row->>p_col)::INTEGER) <> 0 THEN RAISE EXCEPTION 'Esa casilla ya fue disparada.'; END IF;

  hit := ((target_board->p_row->>p_col)::INTEGER) = 1;
  next_shots := jsonb_set(next_shots, ARRAY[p_row::TEXT, p_col::TEXT], to_jsonb(CASE WHEN hit THEN 2 ELSE 1 END), false);

  IF hit THEN
    FOR ship_index IN 0..(jsonb_array_length(target_state->'ships') - 1) LOOP
      ship := target_state->'ships'->ship_index;
      FOR ship_cell_index IN 0..(jsonb_array_length(ship) - 1) LOOP
        cell := ship->ship_cell_index;
        IF (cell->>0)::INTEGER = p_row AND (cell->>1)::INTEGER = p_col THEN
          found_ship := true;
          sunk := true;
          FOR check_cell_index IN 0..(jsonb_array_length(ship) - 1) LOOP
            cell := ship->check_cell_index;
            IF (((next_shots->(cell->>0)::INTEGER)->>(cell->>1)::INTEGER)::INTEGER) <> 2 THEN sunk := false; END IF;
          END LOOP;
          EXIT;
        END IF;
      END LOOP;
      IF found_ship THEN EXIT; END IF;
    END LOOP;
  END IF;

  public_state := room.state;
  public_state := jsonb_set(public_state, ARRAY['shots', shooter.player_index::TEXT], next_shots, true);
  target_alive := COALESCE((public_state->'shipsAlive'->>(1 - shooter.player_index))::INTEGER, 5);
  IF sunk THEN target_alive := target_alive - 1; END IF;
  public_state := jsonb_set(public_state, ARRAY['shipsAlive', (1 - shooter.player_index)::TEXT], to_jsonb(target_alive), true);

  IF target_alive = 0 THEN
    next_status := 'finished';
    next_winner := auth.uid();
    public_state := jsonb_set(public_state, '{winner}', to_jsonb(shooter.player_index), true);
    public_state := jsonb_set(public_state, '{draw}', 'false'::jsonb, true);
    next_turn := auth.uid();
  ELSIF hit THEN
    next_turn := auth.uid();
  ELSE
    next_turn := target_user_id;
  END IF;

  UPDATE public.game_room_players SET private_state = jsonb_set(shooter_state, '{shots}', next_shots, true), updated_at = NOW()
    WHERE room_id = room.id AND user_id = auth.uid();
  UPDATE public.game_rooms SET state = public_state, turn_user_id = next_turn, status = next_status,
    winner_id = next_winner, result = jsonb_build_object('was_hit', hit, 'sunk', sunk),
    revision = revision + 1, updated_at = NOW()
    WHERE id = room.id RETURNING * INTO updated_room;

  RETURN jsonb_build_object('room', to_jsonb(updated_room), 'was_hit', hit, 'sunk', sunk);
END;
$$;

CREATE OR REPLACE FUNCTION public.game_has_line(
  p_board JSONB, p_rows INTEGER, p_cols INTEGER, p_mark INTEGER, p_needed INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  row_index INTEGER;
  col_index INTEGER;
  step_index INTEGER;
  next_row INTEGER;
  next_col INTEGER;
  count_marks INTEGER;
  direction RECORD;
BEGIN
  IF jsonb_typeof(p_board) <> 'array' OR jsonb_array_length(p_board) <> p_rows THEN RETURN false; END IF;
  FOR row_index IN 0..(p_rows - 1) LOOP
    FOR col_index IN 0..(p_cols - 1) LOOP
      IF ((p_board->row_index->>col_index)::INTEGER) = p_mark THEN
        FOR direction IN SELECT * FROM (VALUES (0, 1), (1, 0), (1, 1), (1, -1)) AS directions(dr, dc) LOOP
          count_marks := 1;
          FOR step_index IN 1..(p_needed - 1) LOOP
            next_row := row_index + direction.dr * step_index;
            next_col := col_index + direction.dc * step_index;
            IF next_row < 0 OR next_row >= p_rows OR next_col < 0 OR next_col >= p_cols
               OR ((p_board->next_row->>next_col)::INTEGER) <> p_mark THEN EXIT; END IF;
            count_marks := count_marks + 1;
          END LOOP;
          IF count_marks >= p_needed THEN RETURN true; END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_game_move(
  p_room_id UUID, p_expected_revision INTEGER, p_state JSONB, p_turn_user_id UUID,
  p_status TEXT DEFAULT 'active', p_winner_id UUID DEFAULT NULL, p_result JSONB DEFAULT '{}'::jsonb
)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  room game_rooms%ROWTYPE;
  updated_room game_rooms%ROWTYPE;
  old_board JSONB;
  new_board JSONB;
  player_mark INTEGER;
  changed_cells INTEGER := 0;
  changed_row INTEGER := -1;
  changed_col INTEGER := -1;
  row_index INTEGER;
  col_index INTEGER;
  old_value INTEGER;
  new_value INTEGER;
  winner_mark INTEGER := 0;
  is_draw BOOLEAN := false;
  expected_turn UUID;
BEGIN
  IF p_status NOT IN ('active', 'finished') THEN RAISE EXCEPTION 'Estado de partida no válido.'; END IF;
  IF jsonb_typeof(p_state) <> 'object' THEN RAISE EXCEPTION 'Estado de partida no válido.'; END IF;

  SELECT * INTO room FROM public.game_rooms
    WHERE id = p_room_id AND game_id IN ('conecta4', 'tresenraya')
      AND (host_id = auth.uid() OR guest_id = auth.uid())
      AND status = 'active' AND expires_at > NOW()
      AND turn_user_id = auth.uid() AND revision = p_expected_revision
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La partida cambió. Sincronizando…'; END IF;

  player_mark := CASE WHEN room.host_id = auth.uid() THEN 1 ELSE 2 END;
  old_board := room.state->'board';
  new_board := p_state->'board';

  IF room.game_id = 'tresenraya' THEN
    IF jsonb_typeof(old_board) <> 'array' OR jsonb_array_length(old_board) <> 9
       OR jsonb_typeof(new_board) <> 'array' OR jsonb_array_length(new_board) <> 9 THEN
      RAISE EXCEPTION 'Tablero de Tres en Raya no válido.';
    END IF;
    FOR col_index IN 0..8 LOOP
      old_value := (old_board->>col_index)::INTEGER;
      new_value := (new_board->>col_index)::INTEGER;
      IF old_value <> new_value THEN
        IF old_value <> 0 OR new_value <> player_mark THEN RAISE EXCEPTION 'Movimiento no válido.'; END IF;
        changed_cells := changed_cells + 1;
      END IF;
    END LOOP;
    IF changed_cells <> 1 THEN RAISE EXCEPTION 'El movimiento debe cambiar una sola casilla.'; END IF;
    IF public.game_has_line(new_board, 3, 3, 1, 3) THEN winner_mark := 1;
    ELSIF public.game_has_line(new_board, 3, 3, 2, 3) THEN winner_mark := 2;
    ELSIF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(new_board) AS cells(mark) WHERE cells.mark = '0') THEN is_draw := true;
    END IF;
  ELSE
    IF jsonb_typeof(old_board) <> 'array' OR jsonb_array_length(old_board) <> 6
       OR jsonb_typeof(new_board) <> 'array' OR jsonb_array_length(new_board) <> 6 THEN
      RAISE EXCEPTION 'Tablero de Conecta 4 no válido.';
    END IF;
    FOR row_index IN 0..5 LOOP
      IF jsonb_typeof(old_board->row_index) <> 'array' OR jsonb_array_length(old_board->row_index) <> 7
         OR jsonb_typeof(new_board->row_index) <> 'array' OR jsonb_array_length(new_board->row_index) <> 7 THEN
        RAISE EXCEPTION 'Tablero de Conecta 4 no válido.';
      END IF;
      FOR col_index IN 0..6 LOOP
        old_value := (old_board->row_index->>col_index)::INTEGER;
        new_value := (new_board->row_index->>col_index)::INTEGER;
        IF old_value <> new_value THEN
          IF old_value <> 0 OR new_value <> player_mark OR changed_cells = 1 THEN RAISE EXCEPTION 'Movimiento no válido.'; END IF;
          changed_cells := 1;
          changed_row := row_index;
          changed_col := col_index;
        END IF;
      END LOOP;
    END LOOP;
    IF changed_cells <> 1 THEN RAISE EXCEPTION 'El movimiento debe cambiar una sola casilla.'; END IF;
    -- Una ficha solo puede caer sobre la primera casilla libre de su columna.
    FOR row_index IN 0..5 LOOP
      IF row_index > changed_row AND (new_board->row_index->>changed_col)::INTEGER = 0 THEN
        RAISE EXCEPTION 'La ficha no respeta la gravedad.';
      END IF;
    END LOOP;
    IF public.game_has_line(new_board, 6, 7, 1, 4) THEN winner_mark := 1;
    ELSIF public.game_has_line(new_board, 6, 7, 2, 4) THEN winner_mark := 2;
    ELSIF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(new_board) AS board_rows(row_data),
        LATERAL jsonb_array_elements_text(board_rows.row_data) AS cells(mark) WHERE cells.mark = '0'
    ) THEN is_draw := true;
    END IF;
  END IF;

  expected_turn := CASE WHEN room.host_id = auth.uid() THEN room.guest_id ELSE room.host_id END;
  IF winner_mark <> 0 THEN
    IF p_status <> 'finished' OR p_winner_id <> auth.uid() THEN RAISE EXCEPTION 'Resultado de victoria no válido.'; END IF;
    p_state := jsonb_set(p_state, '{winner}', to_jsonb(CASE WHEN winner_mark = 1 THEN 0 ELSE 1 END), true);
    p_state := jsonb_set(p_state, '{draw}', 'false'::jsonb, true);
    expected_turn := auth.uid();
  ELSIF is_draw THEN
    IF p_status <> 'finished' OR p_winner_id IS NOT NULL THEN RAISE EXCEPTION 'Resultado de empate no válido.'; END IF;
    p_state := jsonb_set(p_state, '{winner}', 'null'::jsonb, true);
    p_state := jsonb_set(p_state, '{draw}', 'true'::jsonb, true);
    expected_turn := auth.uid();
  ELSE
    IF p_status <> 'active' OR p_winner_id IS NOT NULL THEN RAISE EXCEPTION 'La partida aún no ha terminado.'; END IF;
    p_state := jsonb_set(p_state, '{winner}', 'null'::jsonb, true);
    p_state := jsonb_set(p_state, '{draw}', 'false'::jsonb, true);
  END IF;
  p_state := jsonb_set(p_state, '{turn}', to_jsonb(expected_turn), true);

  UPDATE public.game_rooms SET state = p_state, turn_user_id = expected_turn,
    status = CASE WHEN winner_mark <> 0 OR is_draw THEN 'finished' ELSE 'active' END,
    winner_id = CASE WHEN winner_mark <> 0 THEN auth.uid() ELSE NULL END,
    result = COALESCE(p_result, '{}'::jsonb), revision = revision + 1, updated_at = NOW()
    WHERE id = room.id RETURNING * INTO updated_room;
  RETURN updated_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_game_rematch(p_room_id UUID, p_initial_state JSONB)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  room game_rooms%ROWTYPE;
  updated_room game_rooms%ROWTYPE;
  host_ready BOOLEAN;
  guest_ready BOOLEAN;
BEGIN
  SELECT * INTO room FROM public.game_rooms WHERE id = p_room_id
    AND (host_id = auth.uid() OR guest_id = auth.uid()) AND status = 'finished' AND expires_at > NOW() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La revancha ya no está disponible.'; END IF;

  host_ready := room.rematch_host OR room.host_id = auth.uid();
  guest_ready := room.rematch_guest OR room.guest_id = auth.uid();

  IF host_ready AND guest_ready THEN
    UPDATE public.game_rooms SET rematch_host = false, rematch_guest = false,
      status = 'active',
      state = CASE WHEN room.game_id = 'battleship' THEN COALESCE(p_initial_state, '{}'::jsonb) - 'boards' - 'ships'
                   ELSE COALESCE(p_initial_state, '{}'::jsonb) END,
      turn_user_id = host_id, winner_id = NULL, result = '{}'::jsonb,
      revision = revision + 1, updated_at = NOW()
      WHERE id = room.id RETURNING * INTO updated_room;
    IF room.game_id = 'battleship' THEN
      UPDATE public.game_room_players SET private_state = jsonb_build_object(
        'board', p_initial_state->'boards'->0, 'ships', p_initial_state->'ships'->0, 'shots', p_initial_state->'shots'->0
      ), updated_at = NOW() WHERE room_id = room.id AND player_index = 0;
      UPDATE public.game_room_players SET private_state = jsonb_build_object(
        'board', p_initial_state->'boards'->1, 'ships', p_initial_state->'ships'->1, 'shots', p_initial_state->'shots'->1
      ), updated_at = NOW() WHERE room_id = room.id AND player_index = 1;
    END IF;
  ELSE
    UPDATE public.game_rooms SET rematch_host = host_ready, rematch_guest = guest_ready,
      updated_at = NOW() WHERE id = room.id RETURNING * INTO updated_room;
  END IF;
  RETURN updated_room;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_game_invite_targets() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_game_invitation(TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_game_invitation(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_game_room(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_game_player_state(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_battleship_move(UUID, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.game_has_line(JSONB, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_game_move(UUID, INTEGER, JSONB, UUID, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_game_rematch(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_game_invite_targets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_game_invitation(TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_game_invitation(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_game_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_player_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_battleship_move(UUID, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_game_move(UUID, INTEGER, JSONB, UUID, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_game_rematch(UUID, JSONB) TO authenticated;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invitations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==========================================
-- 10. PLAYLISTS — Playlists de música compartidas
--     REGLA: ambos usuarios (pareja) pueden leer y escribir.
--     Solo se guardan nombre/icono/lista de claves de canción;
--     los datos de cada canción viven en el catálogo estático.
-- ==========================================
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '❤️',
  songs JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

-- anon: sin permisos
REVOKE ALL ON playlists FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON playlists TO authenticated;

DROP POLICY IF EXISTS "playlists_read_all" ON playlists;
DROP POLICY IF EXISTS "playlists_write_all" ON playlists;
DROP POLICY IF EXISTS "playlists_update_all" ON playlists;
DROP POLICY IF EXISTS "playlists_delete_all" ON playlists;

CREATE POLICY "playlists_read_all" ON playlists FOR SELECT USING (true);
CREATE POLICY "playlists_write_all" ON playlists FOR INSERT WITH CHECK (true);
CREATE POLICY "playlists_update_all" ON playlists FOR UPDATE USING (true);
CREATE POLICY "playlists_delete_all" ON playlists FOR DELETE USING (true);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
