-- ==========================================
-- 016_AISLAMIENTO_PLAYLISTS.SQL
-- Corrige el aislamiento entre usuarios autenticados.
--
-- IMPORTANTE: la aplicación actual trata las playlists como personales.
-- El modelo de "playlist compartida" debe añadir una tabla de miembros
-- explícita antes de volver a permitir acceso entre usuarios.
-- ==========================================

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

-- Protege también el estado de cuenta: un usuario no puede reactivarse a sí
-- mismo después de que un administrador lo deshabilite.
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE
  USING (id::uuid = auth.uid() OR public.is_admin())
  WITH CHECK (id::uuid = auth.uid() OR public.is_admin());

-- Las filas históricas sin propietario no se pueden asociar de forma segura
-- automáticamente: se vuelven inaccesibles hasta que un administrador las
-- reasigne de manera explícita.

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.enabled IS DISTINCT FROM OLD.enabled THEN
    IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Solo los administradores pueden cambiar role o enabled.';
    END IF;

    IF OLD.id::uuid = auth.uid()
       AND OLD.role = 'admin'
       AND NEW.role <> 'admin'
       AND NOT EXISTS (
         SELECT 1 FROM public.profiles
         WHERE role = 'admin' AND id::uuid <> OLD.id::uuid
       ) THEN
      RAISE EXCEPTION 'No puedes eliminar tu propio rol de administrador porque eres el último administrador.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_prevent_role_change ON public.profiles;
CREATE TRIGGER profiles_prevent_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();


DROP POLICY IF EXISTS "playlists_read_all" ON public.playlists;
DROP POLICY IF EXISTS "playlists_write_all" ON public.playlists;
DROP POLICY IF EXISTS "playlists_update_all" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_all" ON public.playlists;
DROP POLICY IF EXISTS "playlists_select_owner" ON public.playlists;
DROP POLICY IF EXISTS "playlists_insert_owner" ON public.playlists;
DROP POLICY IF EXISTS "playlists_update_owner" ON public.playlists;
DROP POLICY IF EXISTS "playlists_delete_owner" ON public.playlists;

CREATE POLICY "playlists_select_owner" ON public.playlists FOR SELECT
  USING (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "playlists_insert_owner" ON public.playlists FOR INSERT
  WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "playlists_update_owner" ON public.playlists FOR UPDATE
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "playlists_delete_owner" ON public.playlists FOR DELETE
  USING (created_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (id::uuid = auth.uid() AND COALESCE(role, 'user') = 'user')
  );

DROP POLICY IF EXISTS "activity_log_insert_all" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_insert_own" ON public.activity_log;
CREATE POLICY "activity_log_insert_own" ON public.activity_log FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "analytics_visits_insert_all" ON public.analytics_visits;
DROP POLICY IF EXISTS "analytics_visits_insert_own" ON public.analytics_visits;
CREATE POLICY "analytics_visits_insert_own" ON public.analytics_visits FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "analytics_events_insert_all" ON public.analytics_events;
DROP POLICY IF EXISTS "analytics_events_insert_own" ON public.analytics_events;
CREATE POLICY "analytics_events_insert_own" ON public.analytics_events FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);
