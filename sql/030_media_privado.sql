-- ==========================================
-- 030_MEDIA_PRIVADO.SQL
-- Multimedia privado: los buckets dejan de ser públicos y la app pasa a
-- leerlos con URLs firmadas de corta duración.
--
-- QUÉ HACE
--   · Pone en privado `avatars`, `galeria`, `memes` y `audios`.
--   · Deja la LECTURA solo para sesiones autenticadas y habilitadas
--     (`public.is_enabled()`, la misma puerta que ya usan el resto de tablas).
--   · Mantiene la ESCRITURA como estaba: admin en galería/memes/audios, y
--     cada cuenta solo en su carpeta de `avatars` (o el admin).
--   · No crea buckets nuevos ni cambia límites de tamaño o tipos permitidos.
--
-- QUÉ NO HACE (a propósito)
--   · No borra, mueve ni renombra ningún objeto: las fotos, memes, audios y
--     avatares se quedan exactamente donde están.
--   · No toca `content`, `profiles` ni ninguna tabla con datos de la app: las
--     URLs guardadas siguen siendo válidas como identificador y la app las
--     convierte en firmadas al pintar (fase 2 del plan).
--   · No concede escritura a `anon` en ningún caso.
--
-- ORDEN DE APLICACIÓN (importante)
--   1. Desplegar primero el código de la fase 2 (capa de URLs firmadas).
--      Con los buckets todavía públicos, ese código funciona igual que antes.
--   2. Ejecutar ESTE archivo en el SQL Editor de Supabase. Es idempotente:
--      se puede volver a ejecutar sin efectos nuevos.
--   3. Verificar (ver el bloque final). Desde ese momento, una URL pública de
--      Storage deja de servir y la app usa las firmadas.
--
-- ROLLBACK
--   Al final del archivo, en el bloque comentado. Devuelve los buckets a
--   públicos y restaura las políticas de lectura de 006/026. No hay datos que
--   revertir: este archivo no escribe en ninguna tabla de contenido.
-- ==========================================

BEGIN;

-- ==========================================
-- 1 · Buckets privados
-- ==========================================
-- `public = true` significa que Storage sirve el objeto a cualquiera con la
-- URL, sin sesión. Al ponerlo en false, el objeto solo se entrega con una URL
-- firmada (o a `service_role`).
UPDATE storage.buckets
   SET public = false
 WHERE id IN ('avatars', 'galeria', 'memes', 'audios');

-- ==========================================
-- 2 · Lectura: solo sesión iniciada y habilitada
-- ==========================================
-- Las políticas de 026 ya tenían esta forma; se recrean aquí para que este
-- archivo sea autosuficiente en una instalación nueva y para que el `TO
-- authenticated` quede explícito (una política sin `TO` se evalúa también
-- para `anon`, y la anon key viaja en el bundle).
DROP POLICY IF EXISTS avatars_select_all ON storage.objects;
DROP POLICY IF EXISTS galeria_select_all ON storage.objects;
DROP POLICY IF EXISTS memes_select_all ON storage.objects;
DROP POLICY IF EXISTS audios_select_all ON storage.objects;
DROP POLICY IF EXISTS avatars_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS galeria_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS memes_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS audios_select_authenticated ON storage.objects;

CREATE POLICY avatars_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (public.is_enabled() AND bucket_id = 'avatars');

CREATE POLICY galeria_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (public.is_enabled() AND bucket_id = 'galeria');

CREATE POLICY memes_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (public.is_enabled() AND bucket_id = 'memes');

CREATE POLICY audios_select_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (public.is_enabled() AND bucket_id = 'audios');

-- ==========================================
-- 3 · Escritura: igual que antes, sin huecos nuevos
-- ==========================================
-- Se recrean con los mismos criterios de 006 para que la migración no dependa
-- de que aquel archivo se aplicara antes. `anon` no aparece en ninguna: subir
-- exige sesión (y, en galería/memes/audios, ser admin).
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

-- avatares: cada cuenta en su carpeta; el admin, en cualquiera
DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;

CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- galeria / memes / audios: escritura solo admin
DROP POLICY IF EXISTS galeria_insert_admin ON storage.objects;
DROP POLICY IF EXISTS galeria_update_admin ON storage.objects;
DROP POLICY IF EXISTS galeria_delete_admin ON storage.objects;
CREATE POLICY galeria_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'galeria' AND public.is_admin());
CREATE POLICY galeria_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'galeria' AND public.is_admin());
CREATE POLICY galeria_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'galeria' AND public.is_admin());

DROP POLICY IF EXISTS memes_insert_admin ON storage.objects;
DROP POLICY IF EXISTS memes_update_admin ON storage.objects;
DROP POLICY IF EXISTS memes_delete_admin ON storage.objects;
CREATE POLICY memes_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'memes' AND public.is_admin());
CREATE POLICY memes_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'memes' AND public.is_admin());
CREATE POLICY memes_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'memes' AND public.is_admin());

DROP POLICY IF EXISTS audios_insert_admin ON storage.objects;
DROP POLICY IF EXISTS audios_update_admin ON storage.objects;
DROP POLICY IF EXISTS audios_delete_admin ON storage.objects;
CREATE POLICY audios_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'audios' AND public.is_admin());
CREATE POLICY audios_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audios' AND public.is_admin());
CREATE POLICY audios_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'audios' AND public.is_admin());

COMMIT;

-- ==========================================
-- VERIFICACIÓN (solo lectura)
-- ==========================================
-- 1) Los cuatro buckets están privados.
--    Esperado: public = false en las cuatro filas.
-- SELECT id, public FROM storage.buckets
--  WHERE id IN ('avatars', 'galeria', 'memes', 'audios')
--  ORDER BY id;
--
-- 2) Cada bucket tiene su política de lectura SOLO para authenticated.
--    Esperado: 4 filas con roles = {authenticated}.
-- SELECT c.relname AS tabla, p.polname, p.polroles::regrole[] AS roles, p.polcmd
--   FROM pg_policy p
--   JOIN pg_class c ON c.oid = p.polrelid
--  WHERE c.relname = 'objects' AND p.polname LIKE '%_select_authenticated';
--
-- 3) Ninguna política de escritura menciona a anon.
-- SELECT polname FROM pg_policy p
--   JOIN pg_class c ON c.oid = p.polrelid
--  WHERE c.relname = 'objects' AND p.polroles::regrole[]::text[] @> ARRAY['anon'];
--
-- 4) Prueba funcional (la hace la app, con las dos cuentas):
--    · Abrir una foto de la galería, un meme, un audio y un avatar.
--    · Copiar la URL pública de un objeto y abrirla en una pestaña sin sesión:
--      debe responder 400/403, nunca la imagen.
--    · Subir una foto nueva desde el panel (admin) y desde Perfil (avatar).

-- ==========================================
-- ROLLBACK
-- ==========================================
-- Vuelve al estado público anterior. No borra objetos ni datos de la app.
-- Ejecutar el bloque completo en el SQL Editor si algo sale mal:
--
-- BEGIN;
-- UPDATE storage.buckets
--    SET public = true
--  WHERE id IN ('avatars', 'galeria', 'memes', 'audios');
-- DROP POLICY IF EXISTS avatars_select_authenticated ON storage.objects;
-- DROP POLICY IF EXISTS galeria_select_authenticated ON storage.objects;
-- DROP POLICY IF EXISTS memes_select_authenticated ON storage.objects;
-- DROP POLICY IF EXISTS audios_select_authenticated ON storage.objects;
-- CREATE POLICY avatars_select_all ON storage.objects
--   FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY galeria_select_all ON storage.objects
--   FOR SELECT USING (bucket_id = 'galeria');
-- CREATE POLICY memes_select_all ON storage.objects
--   FOR SELECT USING (bucket_id = 'memes');
-- CREATE POLICY audios_select_all ON storage.objects
--   FOR SELECT USING (bucket_id = 'audios');
-- COMMIT;
--
-- (Las políticas de escritura no hace falta revertirlas: son las mismas que
--  ya existían en 006 y siguen sirviendo con el bucket público.)
