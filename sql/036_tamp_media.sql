-- Metadatos de archivos de Tamp.
-- El binario vive en Cloudinary con entrega autenticada. Esta tabla solo
-- guarda referencias y permisos, por lo que un enlace antiguo no concede
-- acceso por sí mismo.
BEGIN;

CREATE TABLE IF NOT EXISTS public.tamp_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL DEFAULT public.current_couple_id() REFERENCES public.couples(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared','private')),
  kind text NOT NULL CHECK (kind IN ('image','video','audio','pdf','gif')),
  public_id text NOT NULL UNIQUE,
  resource_type text NOT NULL CHECK (resource_type IN ('image','video','raw')),
  format text NOT NULL DEFAULT '',
  bytes bigint NOT NULL CHECK (bytes > 0),
  width integer,
  height integer,
  title text NOT NULL DEFAULT '' CHECK (length(title) <= 140),
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  CHECK (public_id LIKE 'tamp/' || couple_id::text || '/%'),
  CHECK ((kind IN ('image','gif') AND resource_type = 'image') OR
         (kind IN ('video','audio') AND resource_type = 'video') OR
         (kind = 'pdf' AND resource_type = 'raw'))
);
CREATE INDEX IF NOT EXISTS tamp_media_scope ON public.tamp_media(couple_id, visibility, created_at DESC);
ALTER TABLE public.tamp_media ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tamp_media FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tamp_media TO authenticated;
GRANT INSERT (id,visibility,kind,public_id,resource_type,format,bytes,width,height,title) ON TABLE public.tamp_media TO authenticated;
GRANT UPDATE (title,removed_at) ON TABLE public.tamp_media TO authenticated;
GRANT ALL ON public.tamp_media TO service_role;

DROP POLICY IF EXISTS tamp_media_read ON public.tamp_media;
CREATE POLICY tamp_media_read ON public.tamp_media FOR SELECT TO authenticated USING (
  public.is_enabled() AND couple_id = public.current_couple_id()
  AND (visibility = 'shared' OR author_id = auth.uid())
  AND (removed_at IS NULL OR (removed_at > now() - interval '30 days' AND author_id = auth.uid()))
);
DROP POLICY IF EXISTS tamp_media_add ON public.tamp_media;
CREATE POLICY tamp_media_add ON public.tamp_media FOR INSERT TO authenticated WITH CHECK (
  public.is_enabled() AND couple_id = public.current_couple_id() AND author_id = auth.uid()
  AND (visibility = 'shared' OR visibility = 'private')
);
DROP POLICY IF EXISTS tamp_media_edit ON public.tamp_media;
CREATE POLICY tamp_media_edit ON public.tamp_media FOR UPDATE TO authenticated USING (
  public.is_enabled() AND couple_id = public.current_couple_id()
  AND author_id = auth.uid() AND (removed_at IS NULL OR removed_at > now() - interval '30 days')
) WITH CHECK (public.is_enabled() AND couple_id = public.current_couple_id() AND author_id = auth.uid());

COMMIT;
