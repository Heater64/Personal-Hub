-- 031_PAREJA_PORTADA.SQL
-- Fotos compartidas de «días juntos» (la tarjeta ancha del Inicio).
--
-- La tarjeta enseña hasta 5 fotos que se turnan cada 5 s. La lista tiene que
-- ser la MISMA para las dos cuentas: la foto se elige en un móvil y aparece en
-- el otro sin volver a subirla, y cualquiera de los dos puede añadir o quitar.
--
-- Dónde vive: `couples.data` (029/030 ya crearon la pareja). Una sola fila por
-- pareja, así que no hay dos listas que se pisen. Los archivos siguen subiéndose
-- al bucket `avatars` dentro de la carpeta de quien los sube (misma RLS que los
-- avatares) y aquí solo se guardan las URLs.
--
-- Sin este archivo la app sigue funcionando: si no puede leer o escribir la
-- fila, la portada se queda en el propio móvil (como antes).
--
-- Idempotente: se puede volver a ejecutar sin romper nada.

ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- La app ya podía leer la fila de su pareja (couples_select_member); para
-- cambiar las fotos hace falta poder actualizarla.
GRANT SELECT, UPDATE ON public.couples TO authenticated;

-- `couple_members` se creó en 029 sin GRANT: PostgREST devolvía 403 aunque la
-- RLS dejaba leer, y todo lo que buscaba la pareja por ahí (fotos, ubicación)
-- fallaba en silencio. Las fotos ya piden el id a `current_couple_id()`, pero
-- el resto de la app sigue necesitando este permiso.
GRANT SELECT ON public.couple_members TO authenticated;
GRANT ALL ON public.couples TO service_role;

DROP POLICY IF EXISTS couples_update_member ON public.couples;
CREATE POLICY couples_update_member ON public.couples FOR UPDATE TO authenticated
  USING (public.is_enabled() AND id = public.current_couple_id())
  WITH CHECK (public.is_enabled() AND id = public.current_couple_id());

-- Realtime: cambiar la foto en un móvil se ve en el otro sin recargar.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.couples;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- ya era miembro de la publicación
END $$;

-- Verificación (con las dos cuentas): las dos deben ver la misma lista.
-- SELECT id, data->'portada' FROM public.couples;
