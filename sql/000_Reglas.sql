-- ==========================================
-- 000_REGLAS.SQL — Permisos base, helpers y migraciones globales
-- Orden: 000 primero (todo lo demás depende de is_admin)
-- ==========================================

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
-- El rol viene de profiles, pero también se acepta el email de admin
-- verificado por Supabase Auth (misma fuente que ADMIN_EMAILS en la app),
-- para no depender de que el perfil tenga el rol correcto.
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id::uuid = auth.uid() AND role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND email = 'admin@personalhub.com'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- LIMPIEZA DE TABLAS ANTIGUAS
-- ==========================================
DROP TABLE IF EXISTS user_profiles CASCADE;
