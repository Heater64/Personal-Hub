-- ==========================================
-- 001_USUARIOS.SQL — Perfiles, triggers y auditoría de roles
-- ==========================================

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


-- ==========================================
-- SYNC PERFIL — mantener profiles al día con auth.users
-- (al cambiar nombre/avatar/email desde cualquier dispositivo,
--  el resto de la app — Admin, invitaciones, rivales — lee de profiles)
-- ==========================================
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), name),
    avatar_url = COALESCE(NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''), avatar_url),
    email = COALESCE(NULLIF(NEW.email, ''), email),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth();

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
