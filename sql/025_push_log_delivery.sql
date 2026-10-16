-- ==========================================
-- 025_PUSH_LOG_DELIVERY.SQL — De «enviado» a «entregado al dispositivo»
--
-- Separa tres cosas que hasta ahora parecían una:
--   · ENVIADO  — el push service aceptó el envío. Es todo lo que el servidor
--                puede afirmar por sí solo.
--   · FALLIDO  — el push service lo rechazó (410/404 = suscripción caducada,
--                u otro error temporal).
--   · ENTREGADO — el DISPOSITIVO confirma que lo recibió. Solo existe cuando
--                hay una confirmación real.
--
-- PROBLEMA QUE RESUELVE (verificado en el código):
--   `push_logs` (022) solo tenía `status` ('sent' | 'failed') y el panel
--   traducía 'sent' como «entregado». Eso es falso: Web Push NO tiene recibo.
--   Que FCM o Mozilla acepten el envío no significa que el aviso haya llegado
--   —el móvil puede estar apagado, sin datos o con la app congelada— y mucho
--   menos que se haya visto. El admin leía «entregado» y daba por hecho algo
--   que la base no sabía.
--
-- QUÉ HACE ESTE ARCHIVO:
--   1. `delivery_id`: token único por dispositivo y envío. Viaja dentro del
--      payload del push; el service worker lo devuelve a
--      /api/push?action=ack al recibirlo.
--   2. `delivered_at`: cuándo lo confirmó el dispositivo. NULL = enviado sin
--      confirmación (no «entregado»).
--   3. Un CHECK del estado, para que no entren estados inventados. Incluye
--      'queued': el envío se registra ANTES de mandarlo (si se registrara
--      después, el acuse del dispositivo llegaría antes que su propia fila y
--      la confirmación se perdería) y 'queued' es exactamente «aún no se
--      sabe», que es la verdad si el proceso muere a mitad.
--
-- LO QUE NO HACE:
--   No promete «visto». Un acuse prueba que el aviso llegó al dispositivo y se
--   mostró; que la persona lo haya leído no lo sabe nadie, y la columna no se
--   llama `seen_at` a propósito.
--
-- REVERSIBILIDAD:
--   `ALTER TABLE public.push_logs DROP COLUMN delivered_at, DROP COLUMN
--   delivery_id;` El servidor tolera la ausencia de las columnas: el acuse
--   responde 503 con la instrucción y el resto del envío funciona igual.
-- ==========================================


-- ==========================================
-- 1 · COLUMNAS DEL ACUSE
-- ==========================================
ALTER TABLE public.push_logs
  ADD COLUMN IF NOT EXISTS delivery_id TEXT;

ALTER TABLE public.push_logs
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- El acuse busca por token; el índice es parcial porque las filas «no
-- enviado» (silencio o avisos apagados) no llevan token.
CREATE INDEX IF NOT EXISTS idx_push_logs_delivery
  ON public.push_logs(delivery_id)
  WHERE delivery_id IS NOT NULL;


-- ==========================================
-- 2 · ESTADOS PERMITIDOS
-- ==========================================
-- Sin CHECK, una errata ('Send', 'sendt') entraría en la tabla y el panel la
-- leería como un fallo sin explicación.
--
-- NOT VALID a propósito: se aplica a lo que se inserte a partir de ahora sin
-- reventar la migración si alguna fila antigua tiene otro valor. Validarlo
-- entero es una decisión aparte, sobre datos ya escritos.
DO $$
BEGIN
  ALTER TABLE public.push_logs
    ADD CONSTRAINT push_logs_status_check
    CHECK (status IN ('queued', 'sent', 'failed', 'skipped')) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ==========================================
-- 3 · VERIFICACIÓN (ejecutar a mano después de aplicar)
-- ==========================================
-- 1. Las columnas existen:
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'push_logs'
--      AND column_name IN ('delivery_id', 'delivered_at');
--
-- 2. Los estados quedan separados (delivered_at solo en lo confirmado):
--
--   SELECT status, count(*),
--          count(delivered_at) AS confirmados_por_el_dispositivo
--     FROM public.push_logs
--    GROUP BY status;
--
-- 3. Un estado inventado se rechaza (debe fallar):
--
--   INSERT INTO public.push_logs (status) VALUES ('sendt');
--
-- 4. La API puede escribir el acuse (service_role):
--
--   SELECT relname, relacl FROM pg_class WHERE relname = 'push_logs';
