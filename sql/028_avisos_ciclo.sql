-- ==========================================
-- 028_AVISOS_CICLO.SQL — El chico se entera de su ciclo
--
-- Añade el interruptor que gobierna los avisos de Menstruación hacia el
-- admin (el chico). Es el mismo mecanismo de 024: una columna por tipo en su
-- fila de `notification_prefs`, leída por el servidor con service_role y
-- escrita por el cliente desde Perfil → Notificaciones.
--
-- QUÉ AVISA (api/push.js, kinds cycle_period | cycle_log | cycle_share):
--   · cycle_period — ella registra una menstruación nueva (o le pone el fin).
--   · cycle_log    — apunta un día del ciclo con flujo, síntomas o nota.
--   · cycle_share  — activa o amplía lo que comparte con él.
-- Los tres comparten interruptor porque son la misma cosa: su ciclo.
--
-- CONSECUENCIAS DE NO APLICARLO:
--   La columna no existe → el upsert del cliente falla y se queda con los
--   valores locales. El servidor, al no encontrar la preferencia, entrega
--   igual (fail open), así que los avisos llegan: solo se pierde el poder
--   apagarlos.
--
-- REVERSIBILIDAD:
--   ALTER TABLE public.notification_prefs DROP COLUMN IF EXISTS admin_cycle;
-- ==========================================

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS admin_cycle BOOLEAN NOT NULL DEFAULT TRUE;


-- ==========================================
-- VERIFICACIÓN (a mano, después de aplicar)
-- ==========================================
-- 1. La columna existe y viene activa:
--
--   SELECT user_id, admin_mood, admin_notes, admin_cycle
--     FROM public.notification_prefs;
--
-- 2. Sigue siendo de cada uno (las políticas de 023 son por fila):
--
--   UPDATE public.notification_prefs SET admin_cycle = false;  -- solo mi fila
