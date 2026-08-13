-- ==========================================
-- PERSONAL HUB — 13. ESCUCHAR JUNTOS (estado compartido autoritativo)
--
-- PROBLEMA: la sincronización anterior usaba un canal broadcast
-- peer-to-peer: cada dispositivo empujaba SU estado y el servidor no
-- validaba nada → ambos se pisaban (ping-pong de canciones y posiciones).
--
-- SOLUCIÓN: una fila única (id=1) con el estado de reproducción que el
-- SERVIDOR arbitra. Cada dispositivo envía su estado y recibe el estado
-- autoritativo de vuelta:
--   · submit_listen_state(...)  → valida y decide qué se aplica.
--   · get_listen_state()        → lectura del estado actual (sondeo ~3x/s).
--
-- REGLAS DEL SERVIDOR:
--   1. Acción explícita (p_is_action=true): cambiar canción, play/pausa o
--      seek del usuario → SIEMPRE se aplica y su autor pasa a ser el líder
--      del reloj compartido (rev en orden de llegada, serializado por lock).
--   2. Heartbeat (p_is_action=false): SOLO el líder actual (o el primer
--      dispositivo tras un líder desconectado >5s) puede avanzar la
--      posición, y solo en la MISMA canción con el MISMO estado y hacia
--      delante. Un seguidor NUNCA arrastra el reloj hacia atrás → se
--      elimina el ping-pong: todos convergen a la misma canción, estado
--      y segundo.
--
-- Pega TODO en el SQL Editor y ejecútalo UNA vez. Idempotente.
-- ==========================================

-- ==========================================
-- 1. TABLA (una sola fila compartida: la sesión de la pareja)
-- ==========================================
CREATE TABLE IF NOT EXISTS listen_sessions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  song_key TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  artist TEXT NOT NULL DEFAULT '',
  playing BOOLEAN NOT NULL DEFAULT false,
  position DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_by UUID,
  revision BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO listen_sessions (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE listen_sessions ENABLE ROW LEVEL SECURITY;
-- Sin acceso directo: solo lectura/escritura vía RPC SECURITY DEFINER.
REVOKE ALL ON listen_sessions FROM anon;
REVOKE ALL ON listen_sessions FROM authenticated;

-- ==========================================
-- 2. SUBMIT_LISTEN_STATE — arbitraje del servidor
-- ==========================================
CREATE OR REPLACE FUNCTION public.submit_listen_state(
  p_song_key TEXT DEFAULT '',
  p_title TEXT DEFAULT '',
  p_artist TEXT DEFAULT '',
  p_playing BOOLEAN DEFAULT false,
  p_position DOUBLE PRECISION DEFAULT 0,
  p_is_action BOOLEAN DEFAULT false
)
RETURNS listen_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cur listen_sessions%ROWTYPE;
  caller UUID;
  pos DOUBLE PRECISION;
  leader_stale BOOLEAN;
BEGIN
  caller := auth.uid();
  IF caller IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;

  -- Validación de entrada: posición finita y dentro de límites.
  IF p_position IS NULL OR p_position <> p_position OR p_position < 0 OR p_position > 86400 THEN
    pos := 0;
  ELSE
    pos := p_position;
  END IF;
  p_song_key := LEFT(COALESCE(p_song_key, ''), 300);
  p_title := LEFT(COALESCE(p_title, ''), 300);
  p_artist := LEFT(COALESCE(p_artist, ''), 300);

  SELECT * INTO cur FROM public.listen_sessions WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.listen_sessions (id) VALUES (1) RETURNING * INTO cur;
  END IF;

  IF p_is_action THEN
    -- Acción explícita del usuario: siempre se aplica; el autor es el líder.
    cur.song_key := p_song_key;
    cur.title := p_title;
    cur.artist := p_artist;
    cur.playing := p_playing;
    cur.position := pos;
    cur.updated_by := caller;
    cur.revision := cur.revision + 1;
    cur.updated_at := NOW();
  ELSE
    -- Heartbeat: solo el líder (o el primero tras líder inactivo >5s) puede
    -- avanzar el reloj, y solo en la misma canción con el mismo estado.
    leader_stale := cur.updated_by IS NULL OR NOW() - cur.updated_at > INTERVAL '5 seconds';
    IF (caller = cur.updated_by OR leader_stale)
       AND p_song_key = cur.song_key AND p_playing = cur.playing
       AND pos >= cur.position THEN
      cur.position := pos;
      cur.updated_by := caller;
      cur.updated_at := NOW();
    END IF;
  END IF;

  UPDATE public.listen_sessions
  SET song_key = cur.song_key, title = cur.title, artist = cur.artist,
      playing = cur.playing, position = cur.position,
      updated_by = cur.updated_by, revision = cur.revision, updated_at = cur.updated_at
  WHERE id = 1;

  RETURN cur;
END;
$$;

-- ==========================================
-- 3. GET_LISTEN_STATE — lectura del estado actual
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_listen_state()
RETURNS listen_sessions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.listen_sessions WHERE id = 1;
$$;

-- ==========================================
-- 4. PERMISOS
-- ==========================================
REVOKE EXECUTE ON FUNCTION public.submit_listen_state(TEXT, TEXT, TEXT, BOOLEAN, DOUBLE PRECISION, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_listen_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_listen_state(TEXT, TEXT, TEXT, BOOLEAN, DOUBLE PRECISION, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_listen_state() TO authenticated;

-- ==========================================
-- 5. REALTIME — notificación push cuando cambia el estado compartido
-- ==========================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.listen_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
