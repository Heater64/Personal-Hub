-- ==========================================
-- 021_MOODS_REALTIME.SQL — Estado de ánimo en tiempo real
-- Permite que los cambios en la tabla `moods` (nuevas filas cuando la
-- usuaria registra su ánimo) viajen por el canal de Realtime de Supabase
-- (postgres_changes), de modo que el Admin recibe el aviso al instante.
--
-- PROBLEMA QUE RESUELVE:
--   Hasta ahora solo la tabla `content` estaba en la publicación
--   supabase_realtime (002). La tabla `moods` (003) NO está, así que
--   los INSERT/UPDATE no se emiten a los canales realtime. El cliente
--   Admin no recibe nada cuando la usuaria guarda su ánimo.
--
-- CÓMO SE USA:
--   realtime.service.js suscribe a `moods` INSERT y, al recibir una fila
--   que no es de su propio usuario, muestra al Admin una notificación
--   local + un toast, y refresca en vivo la pestaña Ánimos.
--
-- IDERME:
--   Sin este script, la app sigue funcionando POR POLVING (realtime.service
--   pulea la tabla `moods` cada 25 s vía SELECT directo, que no necesita la
--   publicación). Realtime solo acelera el aviso del polling a <1 s.
--   Aplicar este script: cambio puntual; no afecta a datos existentes.
-- ==========================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.moods;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- ya era miembro de la publicación
END $$;
