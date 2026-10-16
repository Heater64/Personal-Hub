-- ==========================================
-- 022_PUSH_REMINDERS.SQL — Recordatorios programados en servidor
-- Añade los avisos que NO los decide el navegador: el admin escribe un
-- recordatorio (título, mensaje, destino, fecha/hora y repetición) y el
-- servidor lo envía aunque no haya nadie con la web abierta.
--
-- PROBLEMA QUE RESUELVE:
--   Hasta ahora solo existía un push diario del cron (vercel.json →
--   /api/push?action=send). Todo lo demás lo disparaba el cliente al abrir
--   la app: si la usuaria no entraba, el aviso no llegaba. No había forma
--   de programar «avísale a las 19:00» ni de saber si un envío concreto
--   llegó o falló.
--
-- QUÉ HACE ESTE ARCHIVO:
--   1. Tabla `push_reminders`: un recordatorio por fila, con su próxima
--      ejecución (`next_run_at`) y su repetición ('once' | 'daily' |
--      'weekly').
--   2. Tabla `push_logs`: historial de envíos por recordatorio y
--      dispositivo, para poder mirar qué pasó sin abrir los logs de Vercel.
--   3. RLS: solo el admin LEE. El cliente no escribe: el alta, la edición y
--      el borrado pasan por /api/push?action=reminders con service_role,
--      que valida el token de admin en servidor.
--
-- LO QUE NO HACE:
--   No programa el envío. Este archivo no toca `pg_cron` ni `pg_net`:
--   el disparador periódico necesita dos secretos (la URL de producción y
--   el CRON_SECRET) que no pueden vivir en una migración del repo. Las
--   instrucciones para activarlo están en SUPABASE-SETUP.md §4.
--   Sin ese paso, los recordatorios siguen saliendo: el cron diario de
--   Vercel los vacía cuando pasa por /api/push?action=send.
--
-- REVERSIBILIDAD:
--   `DROP TABLE public.push_logs, public.push_reminders;` devuelve la base
--   al estado anterior. No hay datos que conservar de otras tablas y esta
--   migración no borra ni modifica ninguna fila existente.
-- ==========================================


-- ==========================================
-- 1 · RECORDATORIOS
-- ==========================================
-- `scheduled_at` es la primera ejecución elegida por el admin (y lo que se
-- vuelve a apuntar al editar). `next_run_at` es lo que consulta el
-- programador: se recalcula en cada envío sumando días de calendario en
-- Europe/Madrid, no 24 h exactas, para que «a las 19:00» siga siendo las
-- 19:00 después del cambio de hora.
CREATE TABLE IF NOT EXISTS public.push_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_url TEXT NOT NULL DEFAULT '/',
  scheduled_at TIMESTAMPTZ NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'once'
    CONSTRAINT push_reminders_recurrence_check
    CHECK (recurrence IN ('once', 'daily', 'weekly')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice parcial: el programador solo busca los activos y vencidos, que es
-- una fracción mínima de la tabla. Un índice completo se ensuciaría con los
-- ya enviados (activo = false).
CREATE INDEX IF NOT EXISTS idx_push_reminders_due
  ON public.push_reminders(next_run_at)
  WHERE active;

ALTER TABLE public.push_reminders ENABLE ROW LEVEL SECURITY;

-- anon: sin permisos. Estos datos no son públicos.
REVOKE ALL ON public.push_reminders FROM anon;

-- El admin LEE desde el panel; escribe siempre por la API (service_role).
GRANT SELECT ON public.push_reminders TO authenticated;

DROP POLICY IF EXISTS "push_reminders_select_admin" ON public.push_reminders;
CREATE POLICY "push_reminders_select_admin" ON public.push_reminders FOR SELECT
  USING (public.is_enabled() AND public.is_admin());

-- Sin INSERT/UPDATE/DELETE para el cliente a propósito: un recordatorio
-- dispara notificaciones a todos los dispositivos, así que escribirlo es
-- una operación de servidor. /api/push valida la sesión de admin, los
-- límites de longitud y que el destino sea una ruta interna antes de
-- guardar.

-- service_role es quien escribe (la API). 019 demostró que no basta con el
-- GRANT por defecto de 000_Reglas: se concede explícitamente.
GRANT ALL ON public.push_reminders TO service_role;


-- ==========================================
-- 2 · HISTORIAL DE ENVÍOS
-- ==========================================
-- Una fila por recordatorio y dispositivo. `status` es 'sent' o 'failed'
-- y `error` guarda el código del push service (410, 404…) cuando falla.
-- ON DELETE CASCADE: borrar un recordatorio borra su historial, que sin él
-- no se puede leer (la API lista los logs por recordatorio).
CREATE TABLE IF NOT EXISTS public.push_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reminder_id UUID REFERENCES public.push_reminders(id) ON DELETE CASCADE,
  user_id UUID,
  endpoint TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El panel pide «los últimos envíos de este recordatorio», que es
-- exactamente este índice.
CREATE INDEX IF NOT EXISTS idx_push_logs_reminder
  ON public.push_logs(reminder_id, sent_at DESC);

ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.push_logs FROM anon;
GRANT SELECT ON public.push_logs TO authenticated;

DROP POLICY IF EXISTS "push_logs_select_admin" ON public.push_logs;
CREATE POLICY "push_logs_select_admin" ON public.push_logs FOR SELECT
  USING (public.is_enabled() AND public.is_admin());

GRANT ALL ON public.push_logs TO service_role;

-- Ninguna de las dos entra en la publicación de realtime: nadie las escucha
-- desde el cliente y cada inserción del envío masivo emitiría un evento a
-- todos los oyentes. Al ser tablas nuevas no hay nada que retirar (018 sí
-- tenía que sacar las suscripciones de una publicación ya existente).


-- ==========================================
-- 3 · VERIFICACIÓN (ejecutar a mano después de aplicar)
-- ==========================================
-- 1. El admin las ve, un usuario normal no (entrar con la otra cuenta):
--
--   SELECT count(*) FROM public.push_reminders;   -- admin: N · usuaria: 0
--   SELECT count(*) FROM public.push_logs;        -- admin: N · usuaria: 0
--
-- 2. El cliente no puede escribir (debe fallar por RLS):
--
--   INSERT INTO public.push_reminders (title, body, scheduled_at, next_run_at)
--   VALUES ('x', 'y', now(), now());
--
-- 3. La API sí puede (service_role tiene permisos):
--
--   SELECT relname, relacl FROM pg_class
--    WHERE relname IN ('push_reminders', 'push_logs');
