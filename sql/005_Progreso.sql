-- ==========================================
-- 005_PROGRESO.SQL — Progreso del usuario (user_progress)
-- ==========================================

-- ==========================================
-- 6. USER_PROGRESS — Progreso del usuario (datos personales)
--    REGLA: cada usuario solo su propio progreso (o admin)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, type)
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON user_progress FROM anon;
GRANT ALL ON user_progress TO authenticated;

DROP POLICY IF EXISTS "user_progress_read_all" ON user_progress;
DROP POLICY IF EXISTS "user_progress_insert_all" ON user_progress;
DROP POLICY IF EXISTS "user_progress_update_all" ON user_progress;
DROP POLICY IF EXISTS "user_progress_select_own" ON user_progress;
DROP POLICY IF EXISTS "user_progress_insert_own" ON user_progress;
DROP POLICY IF EXISTS "user_progress_update_own" ON user_progress;
DROP POLICY IF EXISTS "user_progress_delete_own" ON user_progress;

CREATE POLICY "user_progress_select_own" ON user_progress FOR SELECT
  USING (user_id::uuid = auth.uid() OR public.is_admin());

CREATE POLICY "user_progress_insert_own" ON user_progress FOR INSERT
  WITH CHECK (user_id::uuid = auth.uid());

CREATE POLICY "user_progress_update_own" ON user_progress FOR UPDATE
  USING (user_id::uuid = auth.uid() OR public.is_admin());

CREATE POLICY "user_progress_delete_own" ON user_progress FOR DELETE

CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
