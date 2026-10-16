-- ==========================================
-- 023_NOTIFICATION_PREFS.SQL — Preferencias de avisos en el servidor
-- Lleva a la base de datos lo que hasta ahora solo sabía el navegador:
-- qué tipos de aviso quiere cada persona y en qué horas no quiere que
-- suene el teléfono.
--
-- PROBLEMA QUE RESUELVE (verificado en el código):
--   `notifSettings` vivía en localStorage (notifications.service.js) y el
--   horario de silencio se consultaba en el propio cliente antes de mostrar
--   un aviso local. Un aviso enviado por el SERVIDOR —el push diario del cron
--   y, sobre todo, los recordatorios programados de 022— no puede leer ese
--   localStorage: llegaba igual a quien había apagado esa categoría y a las
--   3 de la mañana a quien tenía silencio nocturno. El único límite que
--   respetaba era `profiles.enabled`.
--
-- QUÉ HACE ESTE ARCHIVO:
--   1. Tabla `notification_prefs`: una fila por persona, con los cuatro
--      tipos de aviso y la franja de silencio.
--   2. RLS de dueño: cada persona lee y escribe SOLO su fila (y solo si su
--      cuenta está habilitada). El admin las lee para poder explicar por qué
--      no llegó algo, pero no las escribe.
--
-- POR QUÉ EL CLIENTE SÍ ESCRIBE AQUÍ (a diferencia de push_subscriptions):
--   Una suscripción push es material de servidor —insertarla permitiría
--   apuntar dispositivos ajenos y provocar spam—, así que se escribe solo
--   por la API. Una preferencia es una decisión de la propia persona sobre
--   sus propios avisos: la escribe el cliente con la RLS atándola a
--   `auth.uid()`, sin API de por medio, igual que `moods` o las playlists.
--
-- REVERSIBILIDAD:
--   `DROP TABLE public.notification_prefs;` vuelve al estado anterior: la
--   app sigue funcionando (el cliente cae a localStorage y el servidor, sin
--   fila, entrega como antes).
-- ==========================================


-- ==========================================
-- 1 · TABLA
-- ==========================================
-- Los cuatro tipos son los mismos que el panel de Perfil ofrece, más
-- `reminders` para los avisos que escribe el admin a mano (022): así se
-- puede silenciar un recordatorio sin apagar el saludo diario.
--
-- Horas como texto 'HH:MM' y no `time`: es exactamente lo que devuelve un
-- <input type="time">, se lee sin ambigüedad de zona y el CHECK impide que
-- entre basura (que dejaría el silencio sin efecto).
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily BOOLEAN NOT NULL DEFAULT TRUE,
  letters BOOLEAN NOT NULL DEFAULT TRUE,
  moods BOOLEAN NOT NULL DEFAULT TRUE,
  reminders BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_from TEXT NOT NULL DEFAULT '23:00'
    CONSTRAINT notification_prefs_quiet_from_check
    CHECK (quiet_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_to TEXT NOT NULL DEFAULT '08:00'
    CONSTRAINT notification_prefs_quiet_to_check
    CHECK (quiet_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

-- anon: nada. Son ajustes de una cuenta concreta.
REVOKE ALL ON public.notification_prefs FROM anon;

-- El cliente lee y escribe SU fila (las políticas de abajo lo limitan).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;

DROP POLICY IF EXISTS "notification_prefs_select_own" ON public.notification_prefs;
CREATE POLICY "notification_prefs_select_own" ON public.notification_prefs FOR SELECT
  USING (public.is_enabled() AND (user_id = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "notification_prefs_insert_own" ON public.notification_prefs;
CREATE POLICY "notification_prefs_insert_own" ON public.notification_prefs FOR INSERT
  WITH CHECK (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "notification_prefs_update_own" ON public.notification_prefs;
CREATE POLICY "notification_prefs_update_own" ON public.notification_prefs FOR UPDATE
  USING (public.is_enabled() AND user_id = auth.uid())
  WITH CHECK (public.is_enabled() AND user_id = auth.uid());

DROP POLICY IF EXISTS "notification_prefs_delete_own" ON public.notification_prefs;
CREATE POLICY "notification_prefs_delete_own" ON public.notification_prefs FOR DELETE
  USING (public.is_enabled() AND (user_id = auth.uid() OR public.is_admin()));

-- service_role es quien las lee en el envío (api/push.js): 019 demostró que
-- el GRANT por defecto de 000_Reglas no basta, así que se da explícito.
GRANT ALL ON public.notification_prefs TO service_role;


-- ==========================================
-- 2 · VERIFICACIÓN (ejecutar a mano después de aplicar)
-- ==========================================
-- 1. Cada persona ve solo su fila (entrar con la otra cuenta debe dar 0):
--
--   SELECT user_id FROM public.notification_prefs;
--
-- 2. El CHECK de horas rechaza basura:
--
--   UPDATE public.notification_prefs SET quiet_from = '25:99';  -- debe fallar
--
-- 3. Un usuario no puede escribir la fila de otro (debe fallar por RLS):
--
--   INSERT INTO public.notification_prefs (user_id) VALUES ('<uuid-ajeno>');
--
-- 4. La API puede leerlas todas (service_role):
--
--   SELECT relname, relacl FROM pg_class WHERE relname = 'notification_prefs';
