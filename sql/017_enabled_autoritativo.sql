-- ==========================================
-- 017_ENABLED_AUTORITATIVO.SQL
-- `enabled` pasa a ser una decisión de servidor, no del cliente.
--
-- PROBLEMA QUE RESUELVE (verificado en el código):
--   · El login leía `auth.users.raw_user_meta_data->>'enabled'`.
--   · Supabase permite al usuario editar su propio user_metadata con
--     supabase.auth.updateUser({ data }) SIN ninguna verificación
--     (docs: "Do not use it in security sensitive context… editable by
--     the user without any checks").
--   · El campo realmente protegido era `profiles.enabled`, pero NINGÚN
--     punto de decisión lo leía: era un campo muerto.
--   · Las rutas protegidas y las APIs tampoco lo consultaban, así que
--     una sesión ya abierta seguía funcionando tras deshabilitar.
--
-- QUÉ HACE ESTE ARCHIVO (todo aditivo e idempotente):
--   1. public.is_enabled()  → única fuente de verdad (profiles.enabled).
--   2. is_admin() exige además enabled → un admin deshabilitado pierde
--      privilegios en el mismo instante.
--   3. Trigger en auth.users: un usuario NO puede cambiar
--      raw_user_meta_data.enabled / .role. Sigue el mismo patrón que ya
--      usa la app para nombre/avatar, pero en la capa que no es de
--      fiar. El service_role (API /api/users) sí puede.
--   4. Las RLS de datos personales pasan a exigir is_enabled(): un
--      usuario deshabilitado no lee ni escribe (moods, user_progress,
--      playlists, content, telemetría y su propio avatar en Storage).
--   5. Backfill: si user_metadata.enabled = false → profiles.enabled =
--      false, para que las cuentas ya deshabilitadas queden cerradas de
--      verdad. Es el ÚNICO punto donde se lee metadata, y solo como
--      migración de datos, nunca como decisión.
--
-- NO ES DESTRUCTIVO: no toca datos, no borra filas, no recrea tablas.
-- Solo define funciones, políticas y una única columna de profiles.
-- ==========================================


-- ==========================================
-- 1 · FUNCIÓN is_enabled() — fuente de verdad
-- ==========================================
-- SECURITY DEFINER para leer profiles sin disparar su propia RLS.
--
-- Si el usuario no tiene fila en profiles se considera HABILITADO:
-- no queremos dejar fuera a nadie por un trigger de perfil que falló
-- (is_admin() ya devuelve false sin fila, así que no hay escalón).
CREATE OR REPLACE FUNCTION public.is_enabled()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT p.enabled FROM public.profiles p WHERE p.id::uuid = auth.uid()),
    true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.is_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_enabled() TO authenticated, service_role;


-- ==========================================
-- 2 · is_admin() pasa a exigir enabled
-- ==========================================
-- Antes un admin deshabilitado conservaba TODO su poder hasta que se
-- cerrara sesión. Ahora is_admin() es false en el mismo momento en que
-- profiles.enabled pasa a false, sin importar la sesión que tenga abierta.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.id::uuid = auth.uid()
      AND p.role = 'admin'
      AND COALESCE(p.enabled, true)
      AND u.email_confirmed_at IS NOT NULL
  )
  OR EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND LOWER(email) = 'admin@personalhub.com'
      AND email_confirmed_at IS NOT NULL
      AND COALESCE((SELECT p.enabled FROM public.profiles p WHERE p.id = auth.users.id), true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ==========================================
-- 3 · user_metadata deja de ser editable en los campos de autoridad
-- ==========================================
-- El usuario puede seguir cambiando su nombre y su avatar desde el
-- cliente (es legítimo y sync_profile_from_auth lo recoge). Lo que ya
-- no puede hacer es auto-habilitarse ni auto-ascenderse a admin.
CREATE OR REPLACE FUNCTION public.protect_user_metadata()
RETURNS TRIGGER AS $$
DECLARE
  locked JSONB;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  locked := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- enabled: se restaura el valor que tenía antes del intento.
  IF (OLD.raw_user_meta_data ->> 'enabled') IS DISTINCT FROM (NEW.raw_user_meta_data ->> 'enabled') THEN
    locked := locked || jsonb_build_object('enabled', OLD.raw_user_meta_data -> 'enabled');
  END IF;

  -- role: igual. El rol real vive en profiles.role y lo protege
  -- prevent_role_escalation; aquí evitamos la vía paralela por metadata.
  IF (OLD.raw_user_meta_data ->> 'role') IS DISTINCT FROM (NEW.raw_user_meta_data ->> 'role') THEN
    locked := locked || jsonb_build_object('role', OLD.raw_user_meta_data -> 'role');
  END IF;

  NEW.raw_user_meta_data := locked;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_protect_metadata ON auth.users;
CREATE TRIGGER on_auth_user_protect_metadata
  BEFORE UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_metadata();


-- ==========================================
-- 4 · Impedir el auto-bloqueo del último administrador
-- ==========================================
-- is_admin() ya exige enabled. Sin esta protección, un admin que se
-- deshabilite a sí mismo perdería is_admin() y ya no podría volver a
-- habilitarse: la cuenta quedaría bloqueada para siempre.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.enabled IS DISTINCT FROM OLD.enabled THEN
    IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Solo los administradores pueden cambiar role o enabled.';
    END IF;

    -- Evitar que el último administrador se quite su propio rol…
    IF OLD.id::uuid = auth.uid()
       AND OLD.role = 'admin'
       AND NEW.role <> 'admin'
       AND NOT EXISTS (
         SELECT 1 FROM public.profiles
         WHERE role = 'admin' AND id::uuid <> OLD.id::uuid
       ) THEN
      RAISE EXCEPTION 'No puedes eliminar tu propio rol de administrador porque eres el último administrador.';
    END IF;

    -- …o que se deshabilite a sí mismo (misma trampa, ahora vía enabled).
    IF OLD.id::uuid = auth.uid() AND COALESCE(NEW.enabled, true) = false THEN
      RAISE EXCEPTION 'No puedes deshabilitar tu propia cuenta: te quedarías fuera sin poder volver a entrar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ==========================================
-- 5 · RLS: los datos personales exigEN cuenta habilitada
-- ==========================================
-- Todas son DROP + CREATE: es la única forma de cambiar una policy en
-- Postgres, y es idempotente (se puede re-ejecutar sin romper nada).

-- 5.1 MOODS ------------------------------------------------------------
DROP POLICY IF EXISTS "moods_select_policy" ON public.moods;
CREATE POLICY "moods_select_policy" ON public.moods FOR SELECT
  USING (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "moods_insert_policy" ON public.moods;
CREATE POLICY "moods_insert_policy" ON public.moods FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "moods_update_policy" ON public.moods;
CREATE POLICY "moods_update_policy" ON public.moods FOR UPDATE
  USING (public.is_enabled() AND user_id::uuid = auth.uid())
  WITH CHECK (public.is_enabled() AND user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "moods_delete_policy" ON public.moods;
CREATE POLICY "moods_delete_policy" ON public.moods FOR DELETE
  USING (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()));

-- 5.2 USER_PROGRESS ----------------------------------------------------
-- Nota: 005_Progreso.sql dejaba "user_progress_delete_own" sin USING
-- (policy inútil: PostgreSQL la trata como "no_expression" y no aporta
-- ninguna restricción útil). Se corrige aquí con el aislamiento real.
DROP POLICY IF EXISTS "user_progress_select_own" ON public.user_progress;
CREATE POLICY "user_progress_select_own" ON public.user_progress FOR SELECT
  USING (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "user_progress_insert_own" ON public.user_progress;
CREATE POLICY "user_progress_insert_own" ON public.user_progress FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id::uuid = auth.uid());

DROP POLICY IF EXISTS "user_progress_update_own" ON public.user_progress;
CREATE POLICY "user_progress_update_own" ON public.user_progress FOR UPDATE
  USING (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()))
  WITH CHECK (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "user_progress_delete_own" ON public.user_progress;
CREATE POLICY "user_progress_delete_own" ON public.user_progress FOR DELETE
  USING (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()));

-- 5.3 PLAYLISTS --------------------------------------------------------
DROP POLICY IF EXISTS "playlists_select_owner" ON public.playlists;
CREATE POLICY "playlists_select_owner" ON public.playlists FOR SELECT
  USING (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "playlists_insert_owner" ON public.playlists;
CREATE POLICY "playlists_insert_owner" ON public.playlists FOR INSERT
  WITH CHECK (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "playlists_update_owner" ON public.playlists;
CREATE POLICY "playlists_update_owner" ON public.playlists FOR UPDATE
  USING (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()))
  WITH CHECK (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "playlists_delete_owner" ON public.playlists;
CREATE POLICY "playlists_delete_owner" ON public.playlists FOR DELETE
  USING (public.is_enabled() AND (created_by = auth.uid() OR public.is_admin()));

-- 5.4 CONTENT ---------------------------------------------------------
-- Antes: USING (true). Ahora una cuenta deshabilitada no lee contenido.
DROP POLICY IF EXISTS "content_read_all" ON public.content;
CREATE POLICY "content_read_all" ON public.content FOR SELECT
  USING (public.is_enabled());

-- 5.5 TELEMETRÍA ------------------------------------------------------
-- Estas tablas guardan user_id en TEXT, no UUID: se mantiene la comparación
-- en texto que ya usan 004 y 016.
DROP POLICY IF EXISTS "activity_log_insert_own" ON public.activity_log;
CREATE POLICY "activity_log_insert_own" ON public.activity_log FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid()::text);

DROP POLICY IF EXISTS "analytics_visits_insert_own" ON public.analytics_visits;
CREATE POLICY "analytics_visits_insert_own" ON public.analytics_visits FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid()::text);

DROP POLICY IF EXISTS "analytics_events_insert_own" ON public.analytics_events;
CREATE POLICY "analytics_events_insert_own" ON public.analytics_events FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid()::text);

-- 5.6 STORAGE: avatares ------------------------------------------------
-- Cada usuario gestiona su propio avatar y el admin puede con cualquiera
-- (rama is_admin() intacta: ya exige enabled, así que un admin
-- deshabilitado tampoco escribe). Se añade is_enabled() para que una
-- cuenta deshabilitada no pueda subir su foto. Las policies de
-- galería/memes/audios dependen solo de is_admin() y ya quedan cubiertas.
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (
    public.is_enabled()
    AND bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects FOR UPDATE
  USING (
    public.is_enabled()
    AND bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  )
  WITH CHECK (
    public.is_enabled()
    AND bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects FOR DELETE
  USING (
    public.is_enabled()
    AND bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- avatars_select_all se deja: ver una foto de perfil no es un privilege
-- y hay que poder verla desde la lista de rivales.


-- ==========================================
-- 6 · BACKFILL — cerrar las cuentas ya deshabilitadas
-- ==========================================
-- Única lectura de user_metadata.enabled en todo el sistema, y es una
-- migración de datos: si el admin marcó enabled=false en el panel, la
-- cuenta queda cerrada de verdad en profiles.
--
-- Escribe en la única columna afectada y no borra nada. Es reversible
-- (UPDATE ... SET enabled = true) si hiciera falta.
UPDATE public.profiles p
   SET enabled = false,
       updated_at = NOW()
  FROM auth.users u
 WHERE u.id = p.id
   AND COALESCE(u.raw_user_meta_data ->> 'enabled', 'true') = 'false'
   AND COALESCE(p.enabled, true) = true;


-- ==========================================
-- 7 · VERIFICACIÓN (ejecutar a mano después de aplicar)
-- ==========================================
-- Debe devolver 0 filas:
--
--   SELECT p.email, p.enabled
--     FROM public.profiles p
--     JOIN auth.users u ON u.id = p.id
--    WHERE u.raw_user_meta_data ->> 'enabled' = 'false'
--      AND COALESCE(p.enabled, true);
--
-- Comprobación de que el trigger bloquea el auto-habilitado (debe fallar):
--
--   -- como un usuario normal, en el SQL Editor con su JWT:
--   UPDATE public.profiles SET enabled = true WHERE id = auth.uid();
