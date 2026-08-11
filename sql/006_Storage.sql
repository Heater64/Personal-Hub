-- ==========================================
-- 006_STORAGE.SQL — Buckets públicos + políticas de Storage
-- avatares: lectura pública · escritura carpeta propia o admin
-- galeria/memes/audios: lectura pública · escritura SOLO admin
-- ==========================================

-- ==========================================
-- 5. STORAGE — Buckets públicos
--    avatares:  lectura pública · escritura carpeta propia o admin
--    galeria:   lectura pública · escritura SOLO admin
--    memes:     lectura pública · escritura SOLO admin
--    audios:    lectura pública · escritura SOLO admin
-- ==========================================
-- Crea los buckets si no existen.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('galeria', 'galeria', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('memes', 'memes', true, 52428800, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/x-flac'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('audios', 'audios', true, 52428800, ARRAY['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/flac', 'audio/x-flac'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Permisos sobre el schema de Storage
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
-- anon: solo lectura pública · authenticated: según políticas RLS
REVOKE ALL ON storage.objects FROM anon;
REVOKE ALL ON storage.objects FROM authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT ALL ON storage.objects TO authenticated;

-- Políticas de Storage
DROP POLICY IF EXISTS "avatars_select_all" ON storage.objects;
CREATE POLICY "avatars_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- galeria: lectura pública, escritura SOLO admin
DROP POLICY IF EXISTS "galeria_select_all" ON storage.objects;
CREATE POLICY "galeria_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'galeria');

DROP POLICY IF EXISTS "galeria_insert_admin" ON storage.objects;
CREATE POLICY "galeria_insert_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'galeria' AND public.is_admin());

DROP POLICY IF EXISTS "galeria_update_admin" ON storage.objects;
CREATE POLICY "galeria_update_admin"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'galeria' AND public.is_admin());

DROP POLICY IF EXISTS "galeria_delete_admin" ON storage.objects;
CREATE POLICY "galeria_delete_admin"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'galeria' AND public.is_admin());

-- memes: lectura pública, escritura SOLO admin
DROP POLICY IF EXISTS "memes_select_all" ON storage.objects;
CREATE POLICY "memes_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'memes');

DROP POLICY IF EXISTS "memes_insert_admin" ON storage.objects;
CREATE POLICY "memes_insert_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'memes' AND public.is_admin());

DROP POLICY IF EXISTS "memes_update_admin" ON storage.objects;
CREATE POLICY "memes_update_admin"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'memes' AND public.is_admin());

DROP POLICY IF EXISTS "memes_delete_admin" ON storage.objects;
CREATE POLICY "memes_delete_admin"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'memes' AND public.is_admin());

-- audios: lectura pública, escritura SOLO admin
DROP POLICY IF EXISTS "audios_select_all" ON storage.objects;
CREATE POLICY "audios_select_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'audios');

DROP POLICY IF EXISTS "audios_insert_admin" ON storage.objects;
CREATE POLICY "audios_insert_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audios' AND public.is_admin());

DROP POLICY IF EXISTS "audios_update_admin" ON storage.objects;
CREATE POLICY "audios_update_admin"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'audios' AND public.is_admin());

DROP POLICY IF EXISTS "audios_delete_admin" ON storage.objects;
CREATE POLICY "audios_delete_admin"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'audios' AND public.is_admin());
