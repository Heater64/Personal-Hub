-- ==========================================
-- PERSONAL HUB — 12. JUEGOS ONLINE (modo reto)
-- Todos los juegos individuales pasan a ser jugables online
-- con el "modo reto": cada jugador juega su turno (misma sesión,
-- mismo tiempo) y gana el que consiga más puntos. El servidor
-- valida cada puntuación y decide el ganador.
--
-- Juegos online (19): conecta4, tresenraya, battleship (turnos clásicos)
--   + 2048, agujero-negro, ahorcado, breakout, buscaminas, cuchillos,
--   invaders, laberinto, memoria, meteoritos, pong, simon, snake,
--   tetris, tiroarco, torre (modo reto)
--
-- Pega TODO en el SQL Editor y ejecútalo UNA vez. Idempotente.
-- ==========================================

-- ==========================================
-- 1. AMPLIAR LOS CHECK DE game_id (las tres tablas)
--    Busca y suelta cualquier CHECK que mencione game_id
--    (nombre autogenerado o renombrado) y lo recrea con la lista completa.
-- ==========================================
DO $$
DECLARE constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.game_rooms'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%game_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.game_rooms DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;

  FOR constraint_row IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.game_invitations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%game_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.game_invitations DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;

  FOR constraint_row IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.game_rematch_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%game_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.game_rematch_requests DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;

ALTER TABLE public.game_rooms ADD CONSTRAINT game_rooms_game_id_check
  CHECK (game_id IN ('conecta4','tresenraya','battleship','2048','agujero-negro','ahorcado','breakout','buscaminas','cuchillos','invaders','laberinto','memoria','meteoritos','pong','simon','snake','tetris','tiroarco','torre'));

ALTER TABLE public.game_invitations ADD CONSTRAINT game_invitations_game_id_check
  CHECK (game_id IN ('conecta4','tresenraya','battleship','2048','agujero-negro','ahorcado','breakout','buscaminas','cuchillos','invaders','laberinto','memoria','meteoritos','pong','simon','snake','tetris','tiroarco','torre'));

ALTER TABLE public.game_rematch_requests ADD CONSTRAINT game_rematch_requests_game_id_check
  CHECK (game_id IN ('conecta4','tresenraya','battleship','2048','agujero-negro','ahorcado','breakout','buscaminas','cuchillos','invaders','laberinto','memoria','meteoritos','pong','simon','snake','tetris','tiroarco','torre'));

-- ==========================================
-- 2. CREATE_GAME_INVITATION — aceptar los 19 juegos
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_game_invitation(
  p_game_id TEXT, p_invitee_id UUID, p_initial_state JSONB DEFAULT '{}'::jsonb
)
RETURNS game_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE target profiles%ROWTYPE; created_room game_rooms%ROWTYPE; created_invitation game_invitations%ROWTYPE; current_name TEXT; current_avatar TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;
  IF p_game_id NOT IN ('conecta4','tresenraya','battleship','2048','agujero-negro','ahorcado','breakout','buscaminas','cuchillos','invaders','laberinto','memoria','meteoritos','pong','simon','snake','tetris','tiroarco','torre')
     THEN RAISE EXCEPTION 'Juego no disponible para multijugador.'; END IF;
  IF p_invitee_id = auth.uid() THEN RAISE EXCEPTION 'No puedes invitarte a ti mismo.'; END IF;
  SELECT * INTO target FROM public.profiles WHERE id = p_invitee_id AND enabled = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese usuario no está disponible.'; END IF;
  SELECT COALESCE(NULLIF(name, ''), split_part(email, '@', 1), 'Jugador'), COALESCE(avatar_url, '') INTO current_name, current_avatar
    FROM public.profiles WHERE id = auth.uid();

  -- Libera invitaciones pendientes ya caducadas para permitir una nueva
  -- invitación al mismo juego y usuario sin depender de un cron externo.
  UPDATE public.game_rooms
  SET status = 'cancelled', updated_at = NOW()
  WHERE id IN (
    SELECT room_id FROM public.game_invitations
    WHERE inviter_id = auth.uid() AND invitee_id = p_invitee_id
      AND game_id = p_game_id AND status = 'pending' AND expires_at <= NOW()
  ) AND status = 'waiting';
  UPDATE public.game_invitations
  SET status = 'expired', updated_at = NOW()
  WHERE inviter_id = auth.uid() AND invitee_id = p_invitee_id
    AND game_id = p_game_id AND status = 'pending' AND expires_at <= NOW();

  INSERT INTO public.game_rooms (game_id, host_id, state, turn_user_id)
    VALUES (
      p_game_id,
      auth.uid(),
      CASE WHEN p_game_id = 'battleship' THEN COALESCE(p_initial_state, '{}'::jsonb) - 'boards' - 'ships'
           ELSE COALESCE(p_initial_state, '{}'::jsonb) END,
      auth.uid()
    ) RETURNING * INTO created_room;

  IF p_game_id = 'battleship' THEN
    INSERT INTO public.game_room_players (room_id, user_id, player_index, private_state)
      VALUES
        (created_room.id, auth.uid(), 0, jsonb_build_object(
          'board', p_initial_state->'boards'->0,
          'ships', p_initial_state->'ships'->0,
          'shots', p_initial_state->'shots'->0
        )),
        (created_room.id, p_invitee_id, 1, jsonb_build_object(
          'board', p_initial_state->'boards'->1,
          'ships', p_initial_state->'ships'->1,
          'shots', p_initial_state->'shots'->1
        ));
  END IF;

  INSERT INTO public.game_invitations (room_id, game_id, inviter_id, invitee_id, inviter_name, inviter_avatar)
    VALUES (created_room.id, p_game_id, auth.uid(), p_invitee_id, COALESCE(current_name, 'Jugador'), COALESCE(current_avatar, ''))
    RETURNING * INTO created_invitation;
  RETURN created_invitation;
END;
$$;

-- ==========================================
-- 3. SUBMIT_SCORE_MOVE — turno de modo reto (batalla por puntos)
--    Valida: participante, turno, revisión, sala activa y que la
--    puntuación sea plausible. Guarda la puntuación del jugador y,
--    cuando ambos han puntuado, decide el ganador en el servidor.
-- ==========================================
CREATE OR REPLACE FUNCTION public.submit_score_move(
  p_room_id UUID,
  p_expected_revision INTEGER,
  p_score INTEGER,
  p_result JSONB DEFAULT '{}'::jsonb,
  p_higher_wins BOOLEAN DEFAULT true
)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  room game_rooms%ROWTYPE;
  updated_room game_rooms%ROWTYPE;
  me SMALLINT;
  rival UUID;
  scores JSONB;
  rival_score INTEGER;
  me_wins BOOLEAN;
  new_state JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > 1000000000 THEN RAISE EXCEPTION 'Puntuación no válida.'; END IF;

  SELECT * INTO room FROM public.game_rooms
    WHERE id = p_room_id
      AND (host_id = auth.uid() OR guest_id = auth.uid())
      AND status = 'active' AND expires_at > NOW()
      AND turn_user_id = auth.uid()
      AND revision = p_expected_revision
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La partida cambió. Sincronizando…'; END IF;

  IF room.game_id NOT IN ('2048','agujero-negro','ahorcado','breakout','buscaminas','cuchillos','invaders','laberinto','memoria','meteoritos','pong','simon','snake','tetris','tiroarco','torre') THEN
    RAISE EXCEPTION 'Este juego no admite el modo reto.';
  END IF;

  me := CASE WHEN room.host_id = auth.uid() THEN 0 ELSE 1 END;
  rival := CASE WHEN me = 0 THEN room.guest_id ELSE room.host_id END;
  IF rival IS NULL THEN RAISE EXCEPTION 'La partida aún no tiene rival.'; END IF;

  scores := COALESCE(room.state->'scores', '[null, null]'::jsonb);
  IF jsonb_typeof(scores) <> 'array' OR jsonb_array_length(scores) <> 2 THEN
    scores := '[null, null]'::jsonb;
  END IF;

  -- Un jugador no puede puntuar dos veces.
  IF (scores->me) IS NOT NULL AND (scores->me)::text <> 'null' THEN
    RAISE EXCEPTION 'Ya has enviado tu puntuación.';
  END IF;

  scores := jsonb_set(scores, ARRAY[me::text], to_jsonb(p_score));

  rival_score := NULL;
  IF (scores->(1-me)) IS NOT NULL AND (scores->(1-me))::text <> 'null' THEN
    rival_score := (scores->(1-me))::int;
  END IF;

  IF rival_score IS NULL THEN
    -- El rival aún no ha puntuado: pasa su turno y la sala sigue activa.
    new_state := jsonb_build_object(
      'scores', scores,
      'turn', to_jsonb(rival),
      'winner', 'null'::jsonb,
      'draw', 'false'::jsonb
    );
    UPDATE public.game_rooms SET state = new_state, turn_user_id = rival,
      status = 'active', revision = revision + 1, updated_at = NOW()
      WHERE id = room.id RETURNING * INTO updated_room;
  ELSE
    -- Ambos puntuaron: el servidor decide el ganador.
    -- p_higher_wins=false (Memoria): gana el que MENOS puntos tenga (menos movimientos).
    me_wins := (p_score > rival_score) = p_higher_wins;
    new_state := jsonb_build_object(
      'scores', scores,
      'turn', to_jsonb(rival),
      'winner', to_jsonb(CASE WHEN p_score = rival_score THEN NULL
                              WHEN me_wins THEN me ELSE 1 - me END),
      'draw', to_jsonb(p_score = rival_score)
    );
    UPDATE public.game_rooms SET state = new_state, status = 'finished',
      winner_id = CASE WHEN p_score = rival_score THEN NULL
                       WHEN me_wins THEN auth.uid() ELSE rival END,
      result = COALESCE(p_result, '{}'::jsonb),
      revision = revision + 1, updated_at = NOW()
      WHERE id = room.id RETURNING * INTO updated_room;
  END IF;
  RETURN updated_room;
END;
$$;

-- ==========================================
-- 4. FORFEIT_GAME_ROOM — abandonar una partida en curso
--    Cualquier participante puede rendirse: la sala termina y gana el rival.
--    (El modal de confirmación de salida usa este RPC para no dejar
--     colgada la partida del otro jugador.)
-- ==========================================
CREATE OR REPLACE FUNCTION public.forfeit_game_room(p_room_id UUID)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  room game_rooms%ROWTYPE;
  updated_room game_rooms%ROWTYPE;
  rival UUID;
  new_state JSONB;
BEGIN
  SELECT * INTO room FROM public.game_rooms
    WHERE id = p_room_id AND (host_id = auth.uid() OR guest_id = auth.uid())
      AND status = 'active' AND expires_at > NOW()
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La partida ya no está activa.'; END IF;

  rival := CASE WHEN room.host_id = auth.uid() THEN room.guest_id ELSE room.host_id END;
  IF rival IS NULL THEN RAISE EXCEPTION 'La partida aún no tiene rival.'; END IF;

  new_state := COALESCE(room.state, '{}'::jsonb);
  IF jsonb_typeof(new_state) = 'object' THEN
    new_state := jsonb_set(new_state, '{winner}', to_jsonb(CASE WHEN room.host_id = rival THEN 0 ELSE 1 END), true);
    new_state := jsonb_set(new_state, '{draw}', 'false'::jsonb, true);
  END IF;

  UPDATE public.game_rooms SET status = 'finished', winner_id = rival,
    state = new_state, result = jsonb_build_object('forfeit', true, 'loser_id', auth.uid()),
    revision = revision + 1, updated_at = NOW()
    WHERE id = room.id RETURNING * INTO updated_room;
  DELETE FROM public.game_rematch_requests WHERE room_id = room.id;
  RETURN updated_room;
END;
$$;

-- ==========================================
-- 5. PERMISOS
-- ==========================================
REVOKE EXECUTE ON FUNCTION public.submit_score_move(UUID, INTEGER, INTEGER, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_score_move(UUID, INTEGER, INTEGER, JSONB, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.forfeit_game_room(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forfeit_game_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_game_invitation(TEXT, UUID, JSONB) TO authenticated;
