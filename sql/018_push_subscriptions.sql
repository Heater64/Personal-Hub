-- ==========================================
-- 018_PUSH_SUBSCRIPTIONS.SQL
-- Saca las suscripciones de Web Push de la tabla `content` a una tabla
-- propia con RLS por usuario.
--
-- PROBLEMA QUE RESUELVE (verificado en el código):
--   api/push.js guardaba TODAS las suscripciones en una fila de
--   `content` con id = 'push_subscriptions', dentro de un JSONB.
--   La policy de content es:
--       CREATE POLICY "content_read_all" ON content FOR SELECT USING (true);
--   → cualquier usuario autenticado podía leer
--     select * from content where id = 'push_subscriptions'
--   y obtener el endpoint Push de cada persona Y sus claves de cifrado
--   (keys.p256dh / keys.auth). Con eso se puede enviar notificaciones
--   push a un dispositivo ajeno. No hace falta ser admin: solo estar
--   dentro de la app.
--
--   Además, la fila era escribible por el admin desde el panel de
--   contenido y se perdía en cualquier limpieza de `content`.
--
-- QUÉ HACE ESTE ARCHIVO:
--   1. Tabla propia `push_subscriptions`, una fila por persona/dispositivo.
--   2. RLS real: cada usuario solo ve y borra las suyas. Admin y
--      service_role (la API) leen todas.
--   3. Migra los datos existentes desde la fila de `content` y BORRA esa
--      fila solo cuando la migración ha copiado todo (verificación por
--      recuento, no por suposición).
--   4. Nunca se borra el archivo de la API: si la tabla aún no existe,
--      /api/push sigue funcionando con el almacenamiento anterior.
--
-- REVERSIBILIDAD:
--   · La tabla se puede DROP y volver al estado anterior sin pérdida:
--     la sección 3 deja copia del JSON original en la tabla
--     `push_subscriptions_legacy_backup` (solo lectura, sin permisos
--     para el cliente) antes de eliminar la fila de `content`.
--   · Revertir la app (volver a api/push.js antiguo) no funciona sin
--     la fila: por eso la copia de seguridad se conserva.
-- ==========================================


-- ==========================================
-- 1 · TABLA
-- ==========================================
-- `endpoint` es la URL del push service (FCM/Mozilla/WSA). Es única:
-- un mismo dispositivo no debe duplicarse.
-- Las claves van en columnas separadas, no en un JSONB suelto, para que
-- sea explícito qué se guarda.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL DEFAULT '',
  auth TEXT NOT NULL DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint)
);

-- Índice para el envío masivo (la API filtra por user_id al limpiar).
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- anon: sin permisos. Ni lectura ni escritura.
REVOKE ALL ON public.push_subscriptions FROM anon;

-- El cliente NO escribe aquí: usa /api/push (service_role), que valida
-- la sesión en servidor. Se deja SELECT/DELETE por si algún día el
-- cliente necesita desuscribirse sin pasar por la API, y para que
-- revoke/refresh de sesión no dejen suscripciones huérfanas.
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions FOR SELECT
  USING (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions FOR DELETE
  USING (public.is_enabled() AND (user_id::uuid = auth.uid() OR public.is_admin()));

-- Sin INSERT ni UPDATE para el cliente a propósito: el endpoint de push
-- es material de servidor (VAPID). Insertar desde el navegador permitiría
-- registrar endpoints de otros usuarios y provocar spam de notificaciones.


-- ==========================================
-- 2 · REALTIME fuera
-- ==========================================
-- Las suscripciones no se suscriben en ningún canal. Si la tabla llegara
-- a estar en la publicación de realtime, cada INSERT/DELETE emitiría un
-- evento a todos los oyentes. Se retira de forma idempotente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'push_subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.push_subscriptions';
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL; -- la publicación no existe: nada que hacer
END $$;


-- ==========================================
-- 3 · MIGRACIÓN DE DATOS (idempotente)
-- ==========================================
-- Orden importante:
--   a) copia de seguridad del JSON original
--   b) INSERT ... SELECT del JSONB, ignorando basura
--   c) verificación por recuento
--   d) DELETE de la fila de `content` SOLO si todo está copiado
-- El paso (d) está condicionado: si algo falla, la fila sigue ahí y
-- api/push.js (que aún la lee) no se queda sin datos.
--
-- COPIA DE SEGURIDAD: se crea aunque no haya nada que migrar, para que
-- el orden de pasos sea siempre el mismo y el script sea repetible.

CREATE TABLE IF NOT EXISTS public.push_subscriptions_legacy_backup (
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL
);

-- service_role ya tiene acceso total (000_Reglas.sql). Se revocan los
-- permisos de cliente por si acaso: es una copia de material de cifrado.
REVOKE ALL ON public.push_subscriptions_legacy_backup FROM anon;
REVOKE ALL ON public.push_subscriptions_legacy_backup FROM authenticated;

DO $$
DECLARE
  legacy JSONB;
  n_legacy INT := 0;
  n_copied INT := 0;
BEGIN
  SELECT data INTO legacy
    FROM public.content
   WHERE id = 'push_subscriptions';

  IF legacy IS NULL THEN
    RAISE NOTICE 'push_subscriptions: no hay fila legacy en content. Nada que migrar.';
    RETURN;
  END IF;

  n_legacy := COALESCE(jsonb_array_length(COALESCE(legacy -> 'subscriptions', '[]'::jsonb)), 0);

  -- a) Copia de seguridad (una sola vez: la segunda ejecución no pisa nada).
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions_legacy_backup) THEN
    INSERT INTO public.push_subscriptions_legacy_backup (payload) VALUES (legacy);
  END IF;

  IF n_legacy = 0 THEN
    -- No hay suscripciones: la fila está vacía y no aporta nada.
    DELETE FROM public.content WHERE id = 'push_subscriptions';
    RAISE NOTICE 'push_subscriptions: fila legacy vacía, eliminada.';
    RETURN;
  END IF;

  -- b) Copia. Solo entradas con endpoint y un user_id que exista en
  --    auth.users (si no, la FK lo rechazaría y abortaría la migración).
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
  SELECT
    s.user_id,
    s.endpoint,
    COALESCE(s.p256dh, ''),
    COALESCE(s.auth, ''),
    COALESCE(s.created_at, NOW())
  FROM (
    SELECT
      (e ->> 'userId')::UUID AS user_id,
      e ->> 'endpoint'       AS endpoint,
      e -> 'keys' ->> 'p256dh' AS p256dh,
      e -> 'keys' ->> 'auth'   AS auth,
      NULLIF(e ->> 'createdAt', '')::TIMESTAMPTZ AS created_at
    FROM public.content c,
         LATERAL jsonb_array_elements(COALESCE(c.data -> 'subscriptions', '[]'::jsonb)) AS e
    WHERE c.id = 'push_subscriptions'
      AND e ? 'userId' AND e ? 'endpoint'
      AND NULLIF(e ->> 'userId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND NULLIF(e ->> 'endpoint', '') IS NOT NULL
  ) s
  JOIN auth.users u ON u.id = s.user_id
  ON CONFLICT (endpoint) DO NOTHING;

  GET DIAGNOSTICS n_copied = ROW_COUNT;

  -- c) Recuento real de la tabla destino.
  SELECT COUNT(*) INTO n_copied
    FROM public.push_subscriptions;

  IF n_copied >= n_legacy THEN
    -- d) Todo copiado: la fila de content ya no hace falta y es la vía
    --    de fuga. Se elimina.
    DELETE FROM public.content WHERE id = 'push_subscriptions';
    RAISE NOTICE 'push_subscriptions: % de % suscripciones migradas. Fila legacy eliminada.', n_copied, n_legacy;
  ELSE
    RAISE WARNING 'push_subscriptions: solo % de % copiadas. La fila legacy SE CONSERVA (revisa la tabla).', n_copied, n_legacy;
  END IF;
END $$;


-- ==========================================
-- 4 · VERIFICACIÓN (ejecutar a mano después de aplicar)
-- ==========================================
-- Las dos consultas deben devolver 0 filas.
--
--   -- 1. La fuga sigue abierta?
--   SELECT id FROM public.content WHERE id = 'push_subscriptions';
--
--   -- 2. Hay suscripciones huérfanas (user_id que no existe en auth.users)?
--   SELECT p.id, p.user_id
--     FROM public.push_subscriptions p
--     LEFT JOIN auth.users u ON u.id = p.user_id
--    WHERE u.id IS NULL;
--
-- Comprueba que la tabla quedó aislada (como usuario normal debe dar 0):
--
--   SELECT count(*) FROM public.push_subscriptions;
