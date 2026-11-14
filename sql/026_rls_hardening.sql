-- ==========================================
-- 026_RLS_HARDENING.SQL
-- Endurecimiento tras auditar RLS y privilegios en producción.
--
-- Lo que se encontró (y esto corrige):
--
--   1. profiles: el trigger que impide cambiar `role`/`enabled` solo
--      cubría UPDATE. Un usuario autenticado SIN fila de perfil podía
--      INSERTAR la suya con role='admin' (la policy solo exige
--      id = auth.uid()). Hoy no hay cuentas sin perfil, pero es una
--      escalada a un INSERT de distancia si el trigger de alta falla.
--
--   2. handle_new_user() era SECURITY DEFINER sin `search_path` fijo
--      (aviso del Advisor de Supabase). El resto de funciones ya lo
--      tenían; esta se quedó atrás.
--
--   3. Las funciones de trigger (y dos de mantenimiento) eran
--      ejecutables por PUBLIC: PostgREST las expone como RPC, así que
--      cualquier sesión podía invocar prune_game_history() o
--      backfill_inviter_avatars(). Un trigger no necesita EXECUTE para
--      dispararse: revocarlo no rompe nada.
--
--   4. anon y authenticated conservaban TRUNCATE, REFERENCES y TRIGGER
--      sobre todas las tablas (privilegios por defecto de Supabase).
--      PostgREST no los usa y TRUNCATE se salta RLS: sobran.
--
--   5. Las cuatro políticas SELECT de Storage eran `TO public` y solo
--      filtraban por bucket_id: CUALQUIERA con la anon key (que viaja
--      en el bundle) podía enumerar /storage/v1/object/list/galeria y
--      sacar los nombres de las fotos, memes, audios y avatares. Los
--      nombres de avatar son marcas de tiempo (`1785414666738.jpg`),
--      así que además eran adivinables. Ahora solo una sesión iniciada
--      y habilitada puede listar.
--
--   6. is_admin() seguía con EXECUTE para PUBLIC (el REVOKE de 017 no
--      cuajó sobre esta función). Vuelve a quedar solo para
--      authenticated/service_role, como is_enabled().
--
-- NO ES DESTRUCTIVO: no borra datos ni tablas. Solo redefine una
-- función, un trigger, políticas de Storage y privilegios.
-- ==========================================


-- ==========================================
-- 1 · escalada de rol también en INSERT
-- ==========================================
-- La rama de UPDATE se conserva tal cual (incluidas las protecciones
-- del último admin). En INSERT solo se exige lo mínimo: un no-admin
-- únicamente puede crear un perfil normal y habilitado.
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- auth.role() es NULL cuando la escritura viene del propio GoTrue
    -- (alta de usuario) o del SQL Editor: ahí no hay sesión que limitar.
    IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
      IF NEW.role IS DISTINCT FROM 'user' THEN
        RAISE EXCEPTION 'Solo los administradores pueden crear un perfil de administrador.';
      END IF;
      IF COALESCE(NEW.enabled, true) = false THEN
        RAISE EXCEPTION 'Solo los administradores pueden crear un perfil deshabilitado.';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

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
$$;

-- El trigger pasa a cubrir INSERT y UPDATE. Se recrea con el nombre
-- que describe lo que hace ahora.
DROP TRIGGER IF EXISTS profiles_prevent_role_change ON public.profiles;
DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();


-- ==========================================
-- 2 · search_path fijo en el alta de perfiles
-- ==========================================
ALTER FUNCTION public.handle_new_user() SET search_path TO 'public', 'pg_temp';


-- ==========================================
-- 3 · funciones internas fuera del alcance del cliente
-- ==========================================
-- Funciones de trigger: no comprueban EXECUTE al dispararse.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_from_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_role_escalation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_user_metadata() FROM PUBLIC;

-- Mantenimiento: nadie las llama desde la app.
REVOKE ALL ON FUNCTION public.prune_game_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_inviter_avatars() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_game_history() TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_inviter_avatars() TO service_role;

-- is_enabled() se queda como está: 017 ya la dejó solo para
-- authenticated/service_role. is_admin() sí se cierra aquí, porque
-- seguía abierta a PUBLIC (su ACL era `=X/postgres`).
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;


-- ==========================================
-- 4 · privilegios que PostgREST no usa
-- ==========================================
-- TRUNCATE no pasa por RLS: si algún día se concediera una vía de
-- escritura, sería la puerta más ancha. No hace falta ni para
-- SELECT/INSERT/UPDATE/DELETE.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;


-- ==========================================
-- 5 · Storage: listar deja de ser anónimo
-- ==========================================
-- El bucket sigue siendo público (las imágenes se sirven por URL
-- directa, que es lo que usa la app); lo que se cierra es poder
-- PREGUNTAR qué hay dentro. Sin esto, con la anon key se obtiene la
-- lista completa de nombres de archivo y luego se descargan uno a uno.
DROP POLICY IF EXISTS avatars_select_all ON storage.objects;
DROP POLICY IF EXISTS galeria_select_all ON storage.objects;
DROP POLICY IF EXISTS memes_select_all ON storage.objects;
DROP POLICY IF EXISTS audios_select_all ON storage.objects;
DROP POLICY IF EXISTS avatars_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS galeria_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS memes_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS audios_select_authenticated ON storage.objects;

CREATE POLICY avatars_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (public.is_enabled() AND bucket_id = 'avatars');
CREATE POLICY galeria_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (public.is_enabled() AND bucket_id = 'galeria');
CREATE POLICY memes_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (public.is_enabled() AND bucket_id = 'memes');
CREATE POLICY audios_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (public.is_enabled() AND bucket_id = 'audios');
