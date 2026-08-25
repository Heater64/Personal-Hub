-- ==========================================
-- 008_PLAYLISTS.SQL — Playlists personales aisladas por usuario.
-- Compartir requiere una membresía explícita futura.
-- ==========================================

-- ==========================================
-- 10. PLAYLISTS — Playlists de música compartidas
--     REGLA: ambos usuarios (pareja) pueden leer y escribir.
--     Solo se guardan nombre/icono/lista de claves de canción;
--     los datos de cada canción viven en el catálogo estático.
-- ==========================================
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '❤️',
  songs JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

-- anon: sin permisos
REVOKE ALL ON playlists FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON playlists TO authenticated;

DROP POLICY IF EXISTS "playlists_read_all" ON playlists;
DROP POLICY IF EXISTS "playlists_write_all" ON playlists;
DROP POLICY IF EXISTS "playlists_update_all" ON playlists;
DROP POLICY IF EXISTS "playlists_delete_all" ON playlists;
DROP POLICY IF EXISTS "playlists_select_owner" ON playlists;
DROP POLICY IF EXISTS "playlists_insert_owner" ON playlists;
DROP POLICY IF EXISTS "playlists_update_owner" ON playlists;
DROP POLICY IF EXISTS "playlists_delete_owner" ON playlists;

CREATE POLICY "playlists_select_owner" ON playlists FOR SELECT
  USING (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "playlists_insert_owner" ON playlists FOR INSERT
  WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "playlists_update_owner" ON playlists FOR UPDATE
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "playlists_delete_owner" ON playlists FOR DELETE
  USING (created_by = auth.uid() OR public.is_admin());

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.playlists; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
