-- ==========================================
-- 003_MOODS.SQL — Estados de ánimo diarios (Sentimientos)
-- ==========================================

-- ==========================================
-- 2. MOODS — Estados de ánimo diarios (datos personales)
--    REGLA: cada usuario solo su propio historial (o admin)
-- ==========================================
-- Nota (selección múltiple): una fila puede guardar VARIAS emociones a la
-- vez. En ese caso `mood`, `label` y `emoji` llevan la lista unida por «|»
-- (p. ej. mood = 'triste|cansada') y `score` es la media de sus puntuaciones.
-- Una fila con una sola emoción se guarda exactamente igual que siempre, así
-- que no hace falta migrar el histórico. La codificación vive en
-- tamp/src/data/moods.data.js.
CREATE TABLE IF NOT EXISTS moods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  mood TEXT NOT NULL,
  label TEXT DEFAULT '',
  emoji TEXT DEFAULT '',
  score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migración desde el esquema anterior (UNIQUE user_id+date)
ALTER TABLE moods DROP CONSTRAINT IF EXISTS moods_user_id_date_key;

ALTER TABLE moods ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON moods FROM anon;
GRANT ALL ON moods TO authenticated;

DROP POLICY IF EXISTS "moods_read_all" ON moods;
DROP POLICY IF EXISTS "moods_insert_all" ON moods;
DROP POLICY IF EXISTS "moods_update_all" ON moods;
DROP POLICY IF EXISTS "moods_select_policy" ON moods;
DROP POLICY IF EXISTS "moods_insert_policy" ON moods;
DROP POLICY IF EXISTS "moods_update_policy" ON moods;
DROP POLICY IF EXISTS "moods_delete_policy" ON moods;

CREATE POLICY "moods_select_policy" ON moods FOR SELECT
  USING (user_id::uuid = auth.uid() OR public.is_admin());

CREATE POLICY "moods_insert_policy" ON moods FOR INSERT
  WITH CHECK (user_id::uuid = auth.uid());

CREATE POLICY "moods_update_policy" ON moods FOR UPDATE
  USING (user_id::uuid = auth.uid());

CREATE POLICY "moods_delete_policy" ON moods FOR DELETE
  USING (user_id::uuid = auth.uid() OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_moods_user_date ON moods(user_id, date);
