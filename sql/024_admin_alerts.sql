-- ==========================================
-- 024_ADMIN_ALERTS.SQL — Los avisos del admin, en sus propias columnas
--
-- Separa en dos públicos lo que hasta ahora era un solo sistema de avisos:
--   · La usuaria recibe CONTENIDO (cartas nuevas, novedades del calendario,
--     lo que el admin le escribe) y el acuse de su propio ánimo.
--   · El admin recibe SEGUIMIENTO: que ella ha registrado su ánimo, que ha
--     tenido un mal día, que lo ha cambiado o que ha dejado una nota; más
--     los avisos técnicos cuando algo no se pudo entregar.
--
-- PROBLEMA QUE RESUELVE (verificado en el código):
--   El aviso al admin existía pero era de una sola clase y sin control
--   (`handleNotifyAdmin` en api/push.js mandaba siempre «ha registrado su
--   estado de ánimo»). No distinguía un mal día de un «Bien», no avisaba de
--   las notas de Mal Día, y el admin no podía decidir cuánto quería que le
--   sonara el teléfono: `notification_prefs` (023) solo tenía los tipos de
--   la usuaria, así que la fila del admin no servía para sus propios avisos.
--
-- QUÉ HACE ESTE ARCHIVO:
--   1. Cuatro columnas nuevas en `notification_prefs`, con `TRUE` por
--      defecto: quien no toque nada recibe el seguimiento completo, que es
--      lo que el admin ha pedido.
--   2. Nada más. Las políticas de 023 ya son por FILA (`user_id = auth.uid()`
--      e `is_admin()`), así que cubren estas columnas sin tocarlas: el admin
--      escribe sus cuatro interruptores y nadie puede apagárselos.
--
-- POR QUÉ SIGUE EN `notification_prefs` Y NO EN UNA TABLA APARTE:
--   El admin también es una cuenta con sus propios avisos. Una columna por
--   tipo dentro de su fila hace que el mismo mecanismo de sincronización del
--   cliente (last-write-wins, `syncNotifPrefs`) y el mismo filtro del servidor
--   (`splitRecipients`) valgan para las dos personas, sin una segunda ruta.
--
-- REVERSIBILIDAD:
--   `ALTER TABLE public.notification_prefs DROP COLUMN admin_health, ...;`
--   El servidor tolera la ausencia de las columnas: una lectura que falla
--   devuelve un mapa vacío y el reparto entrega (fail open), así que el
--   código se puede desplegar antes o después de aplicar esto.
-- ==========================================


-- ==========================================
-- 1 · COLUMNAS
-- ==========================================
-- Cada una es un tipo de aviso del admin. `IF NOT EXISTS` las hace
-- idempotentes: este archivo se puede re-ejecutar sin efecto.

-- Que ella registre su ánimo del día (el aviso que ya existía).
ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS admin_mood BOOLEAN NOT NULL DEFAULT TRUE;

-- Que lo cambie más tarde el mismo día. Va aparte del anterior porque es el
-- aviso más repetitivo de los cuatro: la corrección rápida (dentro de la
-- ventana de 5 min de mood.store) NO avisa, pero un cambio de estado sí.
ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS admin_mood_changes BOOLEAN NOT NULL DEFAULT TRUE;

-- Que deje una nota en Mal Día. Es el aviso con más señal de todos: es
-- texto que ella ha escrito a propósito para él.
ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS admin_notes BOOLEAN NOT NULL DEFAULT TRUE;

-- Avisos técnicos: un envío que falló o suscripciones que caducaron. Solo
-- para el admin, nunca para ella: es información de mantenimiento.
ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS admin_health BOOLEAN NOT NULL DEFAULT TRUE;


-- ==========================================
-- 2 · VERIFICACIÓN (ejecutar a mano después de aplicar)
-- ==========================================
-- 1. Las cuatro columnas existen y vienen activas:
--
--   SELECT user_id, admin_mood, admin_mood_changes, admin_notes, admin_health
--     FROM public.notification_prefs;
--
-- 2. Se pueden apagar y siguen siendo de cada uno (RLS de 023):
--
--   UPDATE public.notification_prefs SET admin_mood = false;  -- solo mi fila
--
-- 3. La API las lee con service_role (sin esto, api/push.js no las vería):
--
--   SELECT relname, relacl FROM pg_class WHERE relname = 'notification_prefs';
