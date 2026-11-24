-- Solo el dueño puede borrar su fila de preferencias.
-- 023 permitía también a cualquier admin borrar las preferencias de otra
-- cuenta, pese a que el resto de las operaciones están limitadas al dueño.
DROP POLICY IF EXISTS "notification_prefs_delete_own" ON public.notification_prefs;
CREATE POLICY "notification_prefs_delete_own" ON public.notification_prefs
  FOR DELETE TO authenticated
  USING (public.is_enabled() AND user_id = auth.uid());
