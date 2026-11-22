-- ==========================================
-- 035 · Sorpresas con datos de regalo
--
-- Añade a `tamp_entries` los tres campos de la sección de regalos de
-- DailyHub: presupuesto, enlace de compra y foto.
--
-- Decisiones:
--   · La foto viaja dentro de la fila (data URL ya redimensionada por la
--     app), no a un bucket. Así la privacidad de una sorpresa sigue
--     dependiendo SOLO de la RLS de 034: si el bucket fuera compartido, la
--     pareja podría leer la imagen aunque no viera la fila.
--   · Solo tienen sentido en `kind='surprise'`; el CHECK lo impide en los
--     eventos del calendario y en el registro de Mal Día.
--   · 034 concede INSERT/UPDATE por COLUMNAS. Sin los GRANT de aquí, la app
--     podría leer los campos pero no escribirlos, aunque la tabla tenga las
--     columnas.
--
-- No toca políticas ni datos existentes. Es idempotente: se puede ejecutar
-- dos veces sin efecto.
--
-- Sin esta migración la pantalla Mis sorpresas funciona igual: detecta que
-- las columnas no existen y esconde presupuesto, enlace y foto en la ficha.
-- ==========================================

BEGIN;

ALTER TABLE public.tamp_entries
  ADD COLUMN IF NOT EXISTS price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS link text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS photo text NOT NULL DEFAULT '';

-- Presupuesto: 0 € es válido (un regalo puede ser gratis); el techo evita
-- un cero de más al teclear.
ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_price_range;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_price_range
  CHECK (price IS NULL OR (price >= 0 AND price <= 100000));

ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_link_length;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_link_length
  CHECK (length(link) <= 2000);

-- La app recorta la foto a 640 px y la guarda como data URL JPEG. El tope
-- deja margen a una imagen detallada sin permitir una fila desmedida.
ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_photo_length;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_photo_length
  CHECK (length(photo) <= 400000);

-- Los tres campos son de una sorpresa, nunca de un evento compartido ni de
-- un registro de Mal Día.
ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_gift_fields_surprise;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_gift_fields_surprise
  CHECK (kind = 'surprise' OR (price IS NULL AND link = '' AND photo = ''));

-- 034 ya concedió INSERT/UPDATE por columnas sobre la tabla; los campos
-- nuevos necesitan su propia concesión explícita.
GRANT INSERT (price, link, photo) ON TABLE public.tamp_entries TO authenticated;
GRANT UPDATE (price, link, photo) ON TABLE public.tamp_entries TO authenticated;

COMMIT;

-- ==========================================
-- ROLLBACK (devuelve la tabla a como estaba antes de 035)
--
-- OJO: borra el presupuesto, el enlace y la foto ya guardados. No hay forma
-- de recuperarlos después.
--
-- BEGIN;
-- ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_gift_fields_surprise;
-- ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_photo_length;
-- ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_link_length;
-- ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_price_range;
-- ALTER TABLE public.tamp_entries
--   DROP COLUMN IF EXISTS photo,
--   DROP COLUMN IF EXISTS link,
--   DROP COLUMN IF EXISTS price;
-- COMMIT;
-- ==========================================
