-- ==========================================
-- 002_CONTENIDO.SQL — Tabla content (config general) + datos iniciales
-- Guarda: razones, canciones, series, regalos, cartas OpenWhen, etc.
-- ==========================================

-- ==========================================
-- 1. CONTENT — Toda la config (razones, canciones,
--    noticias, regalos, maldía, series, changelog)
--    REGLA: leer = autenticado · escribir = ADMIN
-- ==========================================
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- anon: SIN permisos sobre content (ni siquiera lectura pre-login)
REVOKE ALL ON content FROM anon;
GRANT SELECT ON content TO authenticated;

DROP POLICY IF EXISTS "content_read_all" ON content;
DROP POLICY IF EXISTS "content_write_all" ON content;
DROP POLICY IF EXISTS "content_update_all" ON content;
DROP POLICY IF EXISTS "content_delete_all" ON content;
DROP POLICY IF EXISTS "content_write_admin" ON content;
DROP POLICY IF EXISTS "content_update_admin" ON content;
DROP POLICY IF EXISTS "content_delete_admin" ON content;

CREATE POLICY "content_read_all" ON content FOR SELECT USING (true);
CREATE POLICY "content_write_admin" ON content FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "content_update_admin" ON content FOR UPDATE USING (public.is_admin());
CREATE POLICY "content_delete_admin" ON content FOR DELETE USING (public.is_admin());

-- Habilita Realtime en la tabla content: cuando el Admin edita cualquier
-- contenido (portadas, razones, canciones, regalos…), los usuarios lo
-- reciben al instante (postgres_changes). Idempotente: no falla si ya
-- estaba en la publicación.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.content;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- ya era miembro de la publicación
END $$;

-- ==========================================
-- DATOS INICIALES
-- ==========================================

-- ==========================================
-- DATOS INICIALES
-- ==========================================
INSERT INTO content (id, data, updated_at) VALUES
  ('razones', '{"reasons": ["Por tu sonrisa", "Por como me miras", "Por ser tu"]}', NOW()),
  ('canciones', '{"songs": [{"title": "Cancion de ejemplo", "artist": "Artista"}]}', NOW()),
 ('noticias', '{"news": [{"title": "Bienvenida!", "date": "Hoy", "description": "Personal Hub ahora usa Supabase 🎉"}]}', NOW()),
  ('gifts', '{"gifts": [], "months": {}}', NOW()),
  ('maldia_frases', '{"phrases": ["Todo va a estar bien ❤️", "Eres mas fuerte de lo que crees"]}', NOW()),
  ('maldia_mensajes', '{"messages": ["Recuerda lo mucho que te quiero", "Siempre estare aqui para ti"]}', NOW()),
  ('changelog', '{"items": ["Migracion completa a Supabase - adios Firebase!"]}', NOW()),
  ('series', '{"items": []}', NOW()),
  ('rincon_covers', '{"covers": {}}', NOW()),
  ('audios', '{"audios": []}', NOW()),
  ('openwhen_letters', '{"letters": []}', NOW())
ON CONFLICT (id) DO NOTHING;
