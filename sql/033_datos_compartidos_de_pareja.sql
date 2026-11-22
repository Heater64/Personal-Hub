-- Datos compartidos de Tamp: ambos pueden consultar los registros del otro.
-- Solo se permite la lectura cruzada cuando hay exactamente dos perfiles
-- habilitados y sus roles son admin/user. Las escrituras siguen siendo propias.
-- Esta migración es local; se debe probar con ambas cuentas antes de aplicarla.

CREATE OR REPLACE FUNCTION public.is_tamp_partner(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles me
      JOIN public.profiles partner ON partner.id = p_user_id
     WHERE me.id = auth.uid()
       AND COALESCE(me.enabled, TRUE)
       AND COALESCE(partner.enabled, TRUE)
       AND ((me.role = 'admin' AND partner.role = 'user')
         OR (me.role = 'user' AND partner.role = 'admin'))
       AND (SELECT count(*) FROM public.profiles WHERE COALESCE(enabled, TRUE)) = 2
  );
$$;

REVOKE ALL ON FUNCTION public.is_tamp_partner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tamp_partner(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_tamp_partner(UUID) TO authenticated, service_role;

-- Autoría intacta: leer datos de pareja no concede permisos para modificarlos.
DROP POLICY IF EXISTS "moods_select_policy" ON public.moods;
CREATE POLICY "moods_select_policy" ON public.moods FOR SELECT
  USING (public.is_enabled() AND (user_id = auth.uid() OR public.is_tamp_partner(user_id)));

DROP POLICY IF EXISTS "moods_delete_policy" ON public.moods;
CREATE POLICY "moods_delete_policy" ON public.moods FOR DELETE
  USING (public.is_enabled() AND user_id = auth.uid());

-- El historial y la configuración menstrual se pueden consultar entre la
-- pareja, mientras cada cuenta conserva sus escrituras y borrados propios.
DROP POLICY IF EXISTS "cycle_settings_select_own" ON public.cycle_settings;
CREATE POLICY "cycle_settings_select_own" ON public.cycle_settings FOR SELECT
  USING (public.is_enabled() AND (user_id = auth.uid() OR public.is_tamp_partner(user_id)));

DROP POLICY IF EXISTS "cycle_periods_select_own" ON public.cycle_periods;
CREATE POLICY "cycle_periods_select_own" ON public.cycle_periods FOR SELECT
  USING (public.is_enabled() AND (user_id = auth.uid() OR public.is_tamp_partner(user_id)));

DROP POLICY IF EXISTS "cycle_daily_logs_select_own" ON public.cycle_daily_logs;
CREATE POLICY "cycle_daily_logs_select_own" ON public.cycle_daily_logs FOR SELECT
  USING (public.is_enabled() AND (user_id = auth.uid() OR public.is_tamp_partner(user_id)));
