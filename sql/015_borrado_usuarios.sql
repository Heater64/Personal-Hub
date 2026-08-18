-- ==========================================
-- 015_BORRADO_USUARIOS.SQL — Políticas DELETE de admin
-- Permite que el panel Admin borre los datos de un usuario directamente
-- desde el cliente (profiles y analytics_visits), también en local, donde
-- la API de Vercel (/api/users) no está disponible.
--
-- Complementa la política moods_delete_policy de 003_Moods.sql, que ya
-- permitía al admin borrar los estados de ánimo de cualquier usuario.
-- Con este archivo, el borrado de un usuario limpia TODOS sus datos:
--   profiles           → su perfil (fuente de listUsers)
--   moods              → sus estados de ánimo (003_Moods.sql)
--   analytics_visits   → sus visitas
--
-- Idempotente: se puede re-ejecutar sin romper nada.
-- Aplicar desde el SQL Editor de Supabase (solo este archivo).
-- ==========================================

-- profiles: el admin puede borrar el perfil de cualquier usuario.
-- (La fila de auth.users solo se puede eliminar con service_role desde
--  /api/users en producción; en local basta con quitar el perfil para que
--  el usuario no reaparezca en el panel.)
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  USING (public.is_admin());

-- analytics_visits: el admin puede borrar las visitas de cualquier usuario.
DROP POLICY IF EXISTS "analytics_visits_delete_admin" ON analytics_visits;
CREATE POLICY "analytics_visits_delete_admin" ON analytics_visits FOR DELETE
  USING (public.is_admin());

-- ==========================================
-- Verificación rápida (opcional): listar las políticas de borrado activas
-- ==========================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('profiles', 'analytics_visits', 'moods')
--   AND cmd = 'DELETE'
-- ORDER BY tablename, policyname;
