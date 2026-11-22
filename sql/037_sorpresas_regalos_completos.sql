-- ==========================================
-- 037 · Sorpresas con los estados de regalo de DailyHub
--
-- 034 limitaba `state` de una sorpresa a tres valores (pendiente,
-- preparado, entregado). La sección de regalos de DailyHub usa cuatro:
-- Idea · Por comprar · Comprado · Entregado. Esta migración:
--
--   · amplía el CHECK para admitir 'comprar' y 'comprado';
--   · conserva 'preparado' porque ya hay filas guardadas con ese valor
--     (la app lo muestra como «Comprado»);
--   · añade `starred` para marcar la sorpresa favorita.
--
-- No toca políticas ni datos existentes. Es idempotente.
--
-- Sin esta migración la pantalla sigue funcionando: detecta que falta
-- `starred` y esconde la favorita, y guarda «Por comprar» como Idea y
-- «Comprado» como Preparada.
-- ==========================================

BEGIN;

ALTER TABLE public.tamp_entries
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;

ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_state_check;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_state_check
  CHECK (
    (kind = 'event' AND state = 'pendiente')
    OR (kind = 'feeling' AND state IN ('pendiente', 'hablado', 'resuelto'))
    OR (kind = 'surprise' AND state IN ('pendiente', 'comprar', 'comprado', 'preparado', 'entregado'))
  );

-- La favorita solo tiene sentido en una sorpresa.
ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_starred_surprise;
ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_starred_surprise
  CHECK (kind = 'surprise' OR starred = false);

GRANT INSERT (starred) ON TABLE public.tamp_entries TO authenticated;
GRANT UPDATE (starred) ON TABLE public.tamp_entries TO authenticated;

COMMIT;

-- ==========================================
-- ROLLBACK (devuelve la tabla a como estaba antes de 037)
--
-- BEGIN;
-- UPDATE public.tamp_entries SET state = 'pendiente' WHERE kind = 'surprise' AND state = 'comprar';
-- UPDATE public.tamp_entries SET state = 'preparado' WHERE kind = 'surprise' AND state = 'comprado';
-- ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_starred_surprise;
-- ALTER TABLE public.tamp_entries DROP CONSTRAINT IF EXISTS tamp_entries_state_check;
-- ALTER TABLE public.tamp_entries ADD CONSTRAINT tamp_entries_state_check
--   CHECK ((kind = 'event' AND state = 'pendiente')
--     OR (kind = 'feeling' AND state IN ('pendiente', 'hablado', 'resuelto'))
--     OR (kind = 'surprise' AND state IN ('pendiente', 'preparado', 'entregado')));
-- ALTER TABLE public.tamp_entries DROP COLUMN IF EXISTS starred;
-- COMMIT;
-- ==========================================
