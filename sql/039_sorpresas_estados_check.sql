-- ==========================================
-- 039 · Arreglar el CHECK de estados de las sorpresas
--
-- En 034 el CHECK de `state` se declaró dentro del CREATE TABLE sin
-- nombre, así que Postgres lo llamó `tamp_entries_check1`. La 037 solo
-- borraba `tamp_entries_state_check` (el nombre que sí usa cuando lo
-- añade), de modo que el CHECK viejo seguía vivo y rechazaba 'comprar'
-- y 'comprado':
--
--   new row for relation "tamp_entries" violates check constraint
--   "tamp_entries_check1"
--
-- Esta migración borra CUALQUIER CHECK de la tabla que mencione `state`
-- (el viejo sin nombre y el nombrado, si existe), y vuelve a crear el
-- único válido con los cuatro estados de regalo de DailyHub.
--
-- Es idempotente y no toca datos ni políticas.
--
-- Sin esta migración la pantalla sigue enseñando los cuatro estados,
-- pero «Por comprar» y «Comprado» fallan al guardar.
-- ==========================================

BEGIN;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.tamp_entries'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%state%'
  LOOP
    EXECUTE format('ALTER TABLE public.tamp_entries DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_state_check
  CHECK (
    (kind = 'event' AND state = 'pendiente')
    OR (kind = 'feeling' AND state IN ('pendiente', 'hablado', 'resuelto'))
    OR (kind = 'surprise' AND state IN ('pendiente', 'comprar', 'comprado', 'preparado', 'entregado'))
  );

-- Sonda para la app: ¿el CHECK vigente acepta ya 'comprar' y 'comprado'?
-- Lee pg_constraint (no escribe nada) y devuelve false si alguna restricción
-- de `state` deja fuera esos valores. Si la función no existe —migración sin
-- aplicar— la RPC falla y la pantalla esconde «Por comprar» y «Comprado».
CREATE OR REPLACE FUNCTION public.tamp_gift_states_supported()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.tamp_entries'::regclass
      AND contype = 'c'
      AND pg_catalog.pg_get_constraintdef(oid) LIKE '%state%'
      AND (
        pg_catalog.pg_get_constraintdef(oid) NOT LIKE '%''comprar''%'
        OR pg_catalog.pg_get_constraintdef(oid) NOT LIKE '%''comprado''%'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.tamp_gift_states_supported() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tamp_gift_states_supported() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tamp_gift_states_supported() TO service_role;

COMMIT;

-- ==========================================
-- ROLLBACK (vuelve al CHECK de 034; antes hay que normalizar los datos)
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.tamp_gift_states_supported();
-- UPDATE public.tamp_entries SET state = 'pendiente' WHERE kind = 'surprise' AND state = 'comprar';
-- UPDATE public.tamp_entries SET state = 'preparado' WHERE kind = 'surprise' AND state = 'comprado';
-- ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_state_check;
-- ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_check1
--   CHECK ((kind = 'event' AND state = 'pendiente')
--     OR (kind = 'feeling' AND state IN ('pendiente', 'hablado', 'resuelto'))
--     OR (kind = 'surprise' AND state IN ('pendiente', 'preparado', 'entregado')));
-- COMMIT;
-- ==========================================
