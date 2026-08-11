-- ==========================================
-- 007_JUEGOS.SQL — Multijugador: salas, invitaciones, RPCs
-- Juegos: conecta4, tresenraya, battleship
-- ==========================================

-- ==========================================
-- 10. MULTIJUGADOR — Invitaciones y salas de juegos
-- ==========================================
CREATE TABLE IF NOT EXISTS game_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL CHECK (game_id IN ('conecta4', 'tresenraya', 'battleship')),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished', 'cancelled')),
  state JSONB NOT NULL DEFAULT '{}',
  turn_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  result JSONB NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 0,
  rematch_host BOOLEAN NOT NULL DEFAULT false,
  rematch_guest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE TABLE IF NOT EXISTS game_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL CHECK (game_id IN ('conecta4', 'tresenraya', 'battleship')),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_name TEXT NOT NULL DEFAULT '',
  inviter_avatar TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  CONSTRAINT game_invitations_not_self CHECK (inviter_id <> invitee_id)
);

-- Estado privado: especialmente importante para no revelar la flota rival.
CREATE TABLE IF NOT EXISTS game_room_players (
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_index SMALLINT NOT NULL CHECK (player_index IN (0, 1)),
  private_state JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id),
  UNIQUE (room_id, player_index)
);

-- Notificaciones de revancha: una fila por petición pendiente.
CREATE TABLE IF NOT EXISTS game_rematch_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL CHECK (game_id IN ('conecta4', 'tresenraya', 'battleship')),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, requester_id)
);

ALTER TABLE game_rematch_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON game_rematch_requests FROM anon;
REVOKE ALL ON game_rematch_requests FROM authenticated;
GRANT SELECT ON game_rematch_requests TO authenticated;

DROP POLICY IF EXISTS "rematch_requests_select_participants" ON game_rematch_requests;
CREATE POLICY "rematch_requests_select_participants" ON game_rematch_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_rooms r
      WHERE r.id = game_rematch_requests.room_id
        AND (r.host_id = auth.uid() OR r.guest_id = auth.uid())
    )
  );

ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_room_players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON game_rooms FROM anon;
REVOKE ALL ON game_rooms FROM authenticated;
REVOKE ALL ON game_invitations FROM anon;
REVOKE ALL ON game_invitations FROM authenticated;
REVOKE ALL ON game_room_players FROM anon;
REVOKE ALL ON game_room_players FROM authenticated;
GRANT SELECT ON game_rooms TO authenticated;
GRANT SELECT ON game_invitations TO authenticated;
GRANT SELECT ON game_room_players TO authenticated;

DROP POLICY IF EXISTS "game_rooms_select_participant" ON game_rooms;
CREATE POLICY "game_rooms_select_participant" ON game_rooms FOR SELECT
  USING (host_id = auth.uid() OR guest_id = auth.uid());
DROP POLICY IF EXISTS "game_invitations_select_participant" ON game_invitations;
CREATE POLICY "game_invitations_select_participant" ON game_invitations FOR SELECT
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());
DROP POLICY IF EXISTS "game_room_players_select_own" ON game_room_players;
CREATE POLICY "game_room_players_select_own" ON game_room_players FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_game_rooms_participants ON game_rooms(host_id, guest_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_room_players_user ON game_room_players(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_invitations_invitee ON game_invitations(invitee_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_invitations_pending_pair
  ON game_invitations(inviter_id, invitee_id, game_id) WHERE status = 'pending';

-- Migra salas antiguas que todavía guardaban la flota completa en state.
INSERT INTO public.game_room_players (room_id, user_id, player_index, private_state)
SELECT id, host_id, 0, jsonb_build_object(
  'board', state->'boards'->0, 'ships', state->'ships'->0, 'shots', state->'shots'->0
)
FROM public.game_rooms
WHERE game_id = 'battleship' AND host_id IS NOT NULL
  AND state ? 'boards' AND state ? 'ships'
ON CONFLICT (room_id, user_id) DO NOTHING;
INSERT INTO public.game_room_players (room_id, user_id, player_index, private_state)
SELECT id, guest_id, 1, jsonb_build_object(
  'board', state->'boards'->1, 'ships', state->'ships'->1, 'shots', state->'shots'->1
)
FROM public.game_rooms
WHERE game_id = 'battleship' AND host_id IS NOT NULL AND guest_id IS NOT NULL
  AND state ? 'boards' AND state ? 'ships'
ON CONFLICT (room_id, user_id) DO NOTHING;
UPDATE public.game_rooms r
SET state = r.state - 'boards' - 'ships'
WHERE r.game_id = 'battleship' AND r.state ? 'boards'
  AND EXISTS (SELECT 1 FROM public.game_room_players p WHERE p.room_id = r.id AND p.player_index = 0)
  AND EXISTS (SELECT 1 FROM public.game_room_players p WHERE p.room_id = r.id AND p.player_index = 1);

CREATE OR REPLACE FUNCTION public.get_game_invite_targets()
RETURNS TABLE (id UUID, name TEXT, email TEXT, avatar_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, COALESCE(NULLIF(p.name, ''), NULLIF(p.email, ''), NULLIF(u.email, ''), 'Usuario'), COALESCE(NULLIF(p.email, ''), u.email), p.avatar_url
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE auth.uid() IS NOT NULL AND p.enabled = true AND p.id <> auth.uid()
  ORDER BY p.name, p.email;
$$;

CREATE OR REPLACE FUNCTION public.create_game_invitation(
  p_game_id TEXT, p_invitee_id UUID, p_initial_state JSONB DEFAULT '{}'::jsonb
)
RETURNS game_invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE target profiles%ROWTYPE; created_room game_rooms%ROWTYPE; created_invitation game_invitations%ROWTYPE; current_name TEXT; current_avatar TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;
  IF p_game_id NOT IN ('conecta4', 'tresenraya', 'battleship') THEN RAISE EXCEPTION 'Juego no disponible para multijugador.'; END IF;
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

CREATE OR REPLACE FUNCTION public.respond_game_invitation(p_invitation_id UUID, p_accept BOOLEAN)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE invitation game_invitations%ROWTYPE; updated_room game_rooms%ROWTYPE;
BEGIN
  SELECT * INTO invitation FROM public.game_invitations
    WHERE id = p_invitation_id AND invitee_id = auth.uid() AND status = 'pending' AND expires_at > NOW() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La invitación ya no está disponible.'; END IF;
  UPDATE public.game_invitations SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END, updated_at = NOW()
    WHERE id = invitation.id;
  IF p_accept THEN
    UPDATE public.game_rooms SET guest_id = auth.uid(), status = 'active', expires_at = NOW() + INTERVAL '24 hours', updated_at = NOW()
      WHERE id = invitation.room_id AND status = 'waiting' RETURNING * INTO updated_room;
    IF invitation.game_id = 'battleship' AND updated_room.state ? 'boards' THEN
      INSERT INTO public.game_room_players (room_id, user_id, player_index, private_state)
        VALUES (updated_room.id, auth.uid(), 1, jsonb_build_object(
          'board', updated_room.state->'boards'->1,
          'ships', updated_room.state->'ships'->1,
          'shots', updated_room.state->'shots'->1
        )) ON CONFLICT (room_id, user_id) DO NOTHING;
      UPDATE public.game_rooms SET state = state - 'boards' - 'ships', updated_at = NOW()
        WHERE id = updated_room.id RETURNING * INTO updated_room;
    END IF;
  ELSE
    UPDATE public.game_rooms SET status = 'cancelled', updated_at = NOW()
      WHERE id = invitation.room_id RETURNING * INTO updated_room;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'La sala ya no está disponible.'; END IF;
  RETURN updated_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_game_room(p_room_id UUID)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE updated_room game_rooms%ROWTYPE;
BEGIN
  UPDATE public.game_rooms SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_room_id AND host_id = auth.uid() AND status = 'waiting'
    RETURNING * INTO updated_room;
  IF NOT FOUND THEN RAISE EXCEPTION 'La invitación ya no se puede cancelar.'; END IF;
  UPDATE public.game_invitations SET status = 'cancelled', updated_at = NOW()
    WHERE room_id = p_room_id AND status = 'pending';
  RETURN updated_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_game_player_state(p_room_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT players.private_state
  FROM public.game_room_players AS players
  JOIN public.game_rooms AS rooms ON rooms.id = players.room_id
  WHERE players.room_id = p_room_id
    AND players.user_id = auth.uid()
    AND (rooms.host_id = auth.uid() OR rooms.guest_id = auth.uid())
    AND rooms.status IN ('active', 'finished');
$$;

CREATE OR REPLACE FUNCTION public.submit_battleship_move(
  p_room_id UUID, p_row INTEGER, p_col INTEGER, p_expected_revision INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  room game_rooms%ROWTYPE;
  shooter game_room_players%ROWTYPE;
  target game_room_players%ROWTYPE;
  target_user_id UUID;
  public_state JSONB;
  shooter_state JSONB;
  target_state JSONB;
  target_board JSONB;
  next_shots JSONB;
  ship JSONB;
  cell JSONB;
  hit BOOLEAN;
  sunk BOOLEAN := false;
  found_ship BOOLEAN := false;
  ship_index INTEGER;
  ship_cell_index INTEGER;
  check_cell_index INTEGER;
  target_alive INTEGER;
  next_turn UUID;
  next_status TEXT := 'active';
  next_winner UUID := NULL;
  updated_room game_rooms%ROWTYPE;
BEGIN
  IF p_row < 0 OR p_row >= 10 OR p_col < 0 OR p_col >= 10 THEN RAISE EXCEPTION 'Coordenada no válida.'; END IF;

  SELECT * INTO room FROM public.game_rooms
    WHERE id = p_room_id AND game_id = 'battleship'
      AND (host_id = auth.uid() OR guest_id = auth.uid())
      AND status = 'active' AND expires_at > NOW()
      AND turn_user_id = auth.uid() AND revision = p_expected_revision
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La partida cambió. Sincronizando…'; END IF;

  SELECT * INTO shooter FROM public.game_room_players
    WHERE room_id = room.id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jugador no encontrado.'; END IF;

  target_user_id := CASE WHEN room.host_id = auth.uid() THEN room.guest_id ELSE room.host_id END;
  SELECT * INTO target FROM public.game_room_players
    WHERE room_id = room.id AND user_id = target_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rival no encontrado.'; END IF;

  shooter_state := shooter.private_state;
  target_state := target.private_state;
  target_board := target_state->'board';
  next_shots := shooter_state->'shots';
  IF jsonb_typeof(target_board) <> 'array' OR jsonb_array_length(target_board) <> 10
     OR jsonb_typeof(next_shots) <> 'array' OR jsonb_array_length(next_shots) <> 10 THEN
    RAISE EXCEPTION 'Estado privado de flota no válido.';
  END IF;
  IF ((next_shots->p_row->>p_col)::INTEGER) <> 0 THEN RAISE EXCEPTION 'Esa casilla ya fue disparada.'; END IF;

  hit := ((target_board->p_row->>p_col)::INTEGER) = 1;
  next_shots := jsonb_set(next_shots, ARRAY[p_row::TEXT, p_col::TEXT], to_jsonb(CASE WHEN hit THEN 2 ELSE 1 END), false);

  IF hit THEN
    FOR ship_index IN 0..(jsonb_array_length(target_state->'ships') - 1) LOOP
      ship := target_state->'ships'->ship_index;
      FOR ship_cell_index IN 0..(jsonb_array_length(ship) - 1) LOOP
        cell := ship->ship_cell_index;
        IF (cell->>0)::INTEGER = p_row AND (cell->>1)::INTEGER = p_col THEN
          found_ship := true;
          sunk := true;
          FOR check_cell_index IN 0..(jsonb_array_length(ship) - 1) LOOP
            cell := ship->check_cell_index;
            IF (((next_shots->(cell->>0)::INTEGER)->>(cell->>1)::INTEGER)::INTEGER) <> 2 THEN sunk := false; END IF;
          END LOOP;
          EXIT;
        END IF;
      END LOOP;
      IF found_ship THEN EXIT; END IF;
    END LOOP;
  END IF;

  public_state := room.state;
  public_state := jsonb_set(public_state, ARRAY['shots', shooter.player_index::TEXT], next_shots, true);
  target_alive := COALESCE((public_state->'shipsAlive'->>(1 - shooter.player_index))::INTEGER, 5);
  IF sunk THEN target_alive := target_alive - 1; END IF;
  public_state := jsonb_set(public_state, ARRAY['shipsAlive', (1 - shooter.player_index)::TEXT], to_jsonb(target_alive), true);

  IF target_alive = 0 THEN
    next_status := 'finished';
    next_winner := auth.uid();
    public_state := jsonb_set(public_state, '{winner}', to_jsonb(shooter.player_index), true);
    public_state := jsonb_set(public_state, '{draw}', 'false'::jsonb, true);
    next_turn := auth.uid();
  ELSIF hit THEN
    next_turn := auth.uid();
  ELSE
    next_turn := target_user_id;
  END IF;

  UPDATE public.game_room_players SET private_state = jsonb_set(shooter_state, '{shots}', next_shots, true), updated_at = NOW()
    WHERE room_id = room.id AND user_id = auth.uid();
  UPDATE public.game_rooms SET state = public_state, turn_user_id = next_turn, status = next_status,
    winner_id = next_winner, result = jsonb_build_object('was_hit', hit, 'sunk', sunk),
    revision = revision + 1, updated_at = NOW()
    WHERE id = room.id RETURNING * INTO updated_room;

  RETURN jsonb_build_object('room', to_jsonb(updated_room), 'was_hit', hit, 'sunk', sunk);
END;
$$;

CREATE OR REPLACE FUNCTION public.game_has_line(
  p_board JSONB, p_rows INTEGER, p_cols INTEGER, p_mark INTEGER, p_needed INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  row_index INTEGER;
  col_index INTEGER;
  step_index INTEGER;
  next_row INTEGER;
  next_col INTEGER;
  count_marks INTEGER;
  direction RECORD;
BEGIN
  IF jsonb_typeof(p_board) <> 'array' OR jsonb_array_length(p_board) <> p_rows THEN RETURN false; END IF;
  FOR row_index IN 0..(p_rows - 1) LOOP
    FOR col_index IN 0..(p_cols - 1) LOOP
      IF ((p_board->row_index->>col_index)::INTEGER) = p_mark THEN
        FOR direction IN SELECT * FROM (VALUES (0, 1), (1, 0), (1, 1), (1, -1)) AS directions(dr, dc) LOOP
          count_marks := 1;
          FOR step_index IN 1..(p_needed - 1) LOOP
            next_row := row_index + direction.dr * step_index;
            next_col := col_index + direction.dc * step_index;
            IF next_row < 0 OR next_row >= p_rows OR next_col < 0 OR next_col >= p_cols
               OR ((p_board->next_row->>next_col)::INTEGER) <> p_mark THEN EXIT; END IF;
            count_marks := count_marks + 1;
          END LOOP;
          IF count_marks >= p_needed THEN RETURN true; END IF;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_game_move(
  p_room_id UUID, p_expected_revision INTEGER, p_state JSONB, p_turn_user_id UUID,
  p_status TEXT DEFAULT 'active', p_winner_id UUID DEFAULT NULL, p_result JSONB DEFAULT '{}'::jsonb
)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  room game_rooms%ROWTYPE;
  updated_room game_rooms%ROWTYPE;
  old_board JSONB;
  new_board JSONB;
  new_board_2d JSONB;
  player_mark INTEGER;
  changed_cells INTEGER := 0;
  changed_row INTEGER := -1;
  changed_col INTEGER := -1;
  row_index INTEGER;
  col_index INTEGER;
  old_value INTEGER;
  new_value INTEGER;
  winner_mark INTEGER := 0;
  is_draw BOOLEAN := false;
  expected_turn UUID;
BEGIN
  IF p_status NOT IN ('active', 'finished') THEN RAISE EXCEPTION 'Estado de partida no válido.'; END IF;
  IF jsonb_typeof(p_state) <> 'object' THEN RAISE EXCEPTION 'Estado de partida no válido.'; END IF;

  SELECT * INTO room FROM public.game_rooms
    WHERE id = p_room_id AND game_id IN ('conecta4', 'tresenraya')
      AND (host_id = auth.uid() OR guest_id = auth.uid())
      AND status = 'active' AND expires_at > NOW()
      AND turn_user_id = auth.uid() AND revision = p_expected_revision
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La partida cambió. Sincronizando…'; END IF;

  player_mark := CASE WHEN room.host_id = auth.uid() THEN 1 ELSE 2 END;
  old_board := room.state->'board';
  new_board := p_state->'board';

  IF room.game_id = 'tresenraya' THEN
    IF jsonb_typeof(old_board) <> 'array' OR jsonb_array_length(old_board) <> 9
       OR jsonb_typeof(new_board) <> 'array' OR jsonb_array_length(new_board) <> 9 THEN
      RAISE EXCEPTION 'Tablero de Tres en Raya no válido.';
    END IF;
    FOR col_index IN 0..8 LOOP
      old_value := (old_board->>col_index)::INTEGER;
      new_value := (new_board->>col_index)::INTEGER;
      IF old_value <> new_value THEN
        IF old_value <> 0 OR new_value <> player_mark THEN RAISE EXCEPTION 'Movimiento no válido.'; END IF;
        changed_cells := changed_cells + 1;
      END IF;
    END LOOP;
    IF changed_cells <> 1 THEN RAISE EXCEPTION 'El movimiento debe cambiar una sola casilla.'; END IF;
    -- Tres en Raya guarda el tablero como array plano de 9; game_has_line espera 2D.
    new_board_2d := jsonb_build_array(
      jsonb_build_array((new_board->>0)::INTEGER, (new_board->>1)::INTEGER, (new_board->>2)::INTEGER),
      jsonb_build_array((new_board->>3)::INTEGER, (new_board->>4)::INTEGER, (new_board->>5)::INTEGER),
      jsonb_build_array((new_board->>6)::INTEGER, (new_board->>7)::INTEGER, (new_board->>8)::INTEGER)
    );
    IF public.game_has_line(new_board_2d, 3, 3, 1, 3) THEN winner_mark := 1;
    ELSIF public.game_has_line(new_board_2d, 3, 3, 2, 3) THEN winner_mark := 2;
    ELSIF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(new_board) AS cells(mark) WHERE cells.mark = '0') THEN is_draw := true;
    END IF;
  ELSE
    IF jsonb_typeof(old_board) <> 'array' OR jsonb_array_length(old_board) <> 6
       OR jsonb_typeof(new_board) <> 'array' OR jsonb_array_length(new_board) <> 6 THEN
      RAISE EXCEPTION 'Tablero de Conecta 4 no válido.';
    END IF;
    FOR row_index IN 0..5 LOOP
      IF jsonb_typeof(old_board->row_index) <> 'array' OR jsonb_array_length(old_board->row_index) <> 7
         OR jsonb_typeof(new_board->row_index) <> 'array' OR jsonb_array_length(new_board->row_index) <> 7 THEN
        RAISE EXCEPTION 'Tablero de Conecta 4 no válido.';
      END IF;
      FOR col_index IN 0..6 LOOP
        old_value := (old_board->row_index->>col_index)::INTEGER;
        new_value := (new_board->row_index->>col_index)::INTEGER;
        IF old_value <> new_value THEN
          IF old_value <> 0 OR new_value <> player_mark OR changed_cells = 1 THEN RAISE EXCEPTION 'Movimiento no válido.'; END IF;
          changed_cells := 1;
          changed_row := row_index;
          changed_col := col_index;
        END IF;
      END LOOP;
    END LOOP;
    IF changed_cells <> 1 THEN RAISE EXCEPTION 'El movimiento debe cambiar una sola casilla.'; END IF;
    -- Una ficha solo puede caer sobre la primera casilla libre de su columna.
    FOR row_index IN 0..5 LOOP
      IF row_index > changed_row AND (new_board->row_index->>changed_col)::INTEGER = 0 THEN
        RAISE EXCEPTION 'La ficha no respeta la gravedad.';
      END IF;
    END LOOP;
    IF public.game_has_line(new_board, 6, 7, 1, 4) THEN winner_mark := 1;
    ELSIF public.game_has_line(new_board, 6, 7, 2, 4) THEN winner_mark := 2;
    ELSIF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(new_board) AS board_rows(row_data),
        LATERAL jsonb_array_elements_text(board_rows.row_data) AS cells(mark) WHERE cells.mark = '0'
    ) THEN is_draw := true;
    END IF;
  END IF;

  expected_turn := CASE WHEN room.host_id = auth.uid() THEN room.guest_id ELSE room.host_id END;
  IF winner_mark <> 0 THEN
    IF p_status <> 'finished' OR p_winner_id <> auth.uid() THEN RAISE EXCEPTION 'Resultado de victoria no válido.'; END IF;
    p_state := jsonb_set(p_state, '{winner}', to_jsonb(CASE WHEN winner_mark = 1 THEN 0 ELSE 1 END), true);
    p_state := jsonb_set(p_state, '{draw}', 'false'::jsonb, true);
    expected_turn := auth.uid();
  ELSIF is_draw THEN
    IF p_status <> 'finished' OR p_winner_id IS NOT NULL THEN RAISE EXCEPTION 'Resultado de empate no válido.'; END IF;
    p_state := jsonb_set(p_state, '{winner}', 'null'::jsonb, true);
    p_state := jsonb_set(p_state, '{draw}', 'true'::jsonb, true);
    expected_turn := auth.uid();
  ELSE
    IF p_status <> 'active' OR p_winner_id IS NOT NULL THEN RAISE EXCEPTION 'La partida aún no ha terminado.'; END IF;
    p_state := jsonb_set(p_state, '{winner}', 'null'::jsonb, true);
    p_state := jsonb_set(p_state, '{draw}', 'false'::jsonb, true);
  END IF;
  p_state := jsonb_set(p_state, '{turn}', to_jsonb(expected_turn), true);

  UPDATE public.game_rooms SET state = p_state, turn_user_id = expected_turn,
    status = CASE WHEN winner_mark <> 0 OR is_draw THEN 'finished' ELSE 'active' END,
    winner_id = CASE WHEN winner_mark <> 0 THEN auth.uid() ELSE NULL END,
    result = COALESCE(p_result, '{}'::jsonb), revision = revision + 1, updated_at = NOW()
    WHERE id = room.id RETURNING * INTO updated_room;
  RETURN updated_room;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_game_rematch(p_room_id UUID, p_initial_state JSONB)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  room game_rooms%ROWTYPE;
  updated_room game_rooms%ROWTYPE;
  host_ready BOOLEAN;
  guest_ready BOOLEAN;
  next_state JSONB;
BEGIN
  SELECT * INTO room FROM public.game_rooms WHERE id = p_room_id
    AND (host_id = auth.uid() OR guest_id = auth.uid()) AND status = 'finished' AND expires_at > NOW() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La revancha ya no está disponible.'; END IF;

  host_ready := room.rematch_host OR room.host_id = auth.uid();
  guest_ready := room.rematch_guest OR room.guest_id = auth.uid();

  next_state := CASE
    WHEN COALESCE(p_initial_state, '{}'::jsonb) = '{}'::jsonb THEN room.state
    ELSE COALESCE(p_initial_state, '{}'::jsonb)
  END;
  IF host_ready AND guest_ready THEN
    UPDATE public.game_rooms SET rematch_host = false, rematch_guest = false,
      status = 'active',
      state = CASE WHEN room.game_id = 'battleship' THEN next_state - 'boards' - 'ships'
                   ELSE next_state END,
      turn_user_id = host_id, winner_id = NULL, result = '{}'::jsonb,
      revision = revision + 1, updated_at = NOW()
      WHERE id = room.id RETURNING * INTO updated_room;
    DELETE FROM public.game_rematch_requests WHERE room_id = room.id;
    IF room.game_id = 'battleship' THEN
      IF COALESCE(p_initial_state, '{}'::jsonb) = '{}'::jsonb THEN
        -- Aceptación desde notificación: se conservan las flotas ya guardadas al pedir.
        NULL;
      ELSE
        UPDATE public.game_room_players SET private_state = jsonb_build_object(
          'board', p_initial_state->'boards'->0, 'ships', p_initial_state->'ships'->0, 'shots', p_initial_state->'shots'->0
        ), updated_at = NOW() WHERE room_id = room.id AND player_index = 0;
        UPDATE public.game_room_players SET private_state = jsonb_build_object(
          'board', p_initial_state->'boards'->1, 'ships', p_initial_state->'ships'->1, 'shots', p_initial_state->'shots'->1
        ), updated_at = NOW() WHERE room_id = room.id AND player_index = 1;
      END IF;
    END IF;
  ELSE
    UPDATE public.game_rooms SET rematch_host = host_ready, rematch_guest = guest_ready,
      updated_at = NOW() WHERE id = room.id RETURNING * INTO updated_room;
    IF updated_room.host_id = auth.uid() AND updated_room.rematch_host AND NOT updated_room.rematch_guest THEN
      INSERT INTO public.game_rematch_requests (room_id, game_id, requester_id)
        VALUES (updated_room.id, updated_room.game_id, auth.uid())
      ON CONFLICT (room_id, requester_id) DO NOTHING;
    ELSIF updated_room.guest_id = auth.uid() AND updated_room.rematch_guest AND NOT updated_room.rematch_host THEN
      INSERT INTO public.game_rematch_requests (room_id, game_id, requester_id)
        VALUES (updated_room.id, updated_room.game_id, auth.uid())
      ON CONFLICT (room_id, requester_id) DO NOTHING;
    END IF;
  END IF;
  RETURN updated_room;
END;
$$;

-- Rechazar una revancha pendiente (cualquiera de los dos jugadores).
CREATE OR REPLACE FUNCTION public.reject_game_rematch(p_room_id UUID)
RETURNS game_rooms
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE updated_room game_rooms%ROWTYPE;
BEGIN
  UPDATE public.game_rooms
  SET rematch_host = false,
      rematch_guest = false,
      updated_at = NOW()
  WHERE id = p_room_id
    AND (host_id = auth.uid() OR guest_id = auth.uid())
    AND status = 'finished'
  RETURNING * INTO updated_room;
  IF NOT FOUND THEN RAISE EXCEPTION 'La sala ya no está disponible.'; END IF;
  DELETE FROM public.game_rematch_requests WHERE room_id = p_room_id;
  RETURN updated_room;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_game_invite_targets() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_game_invitation(TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_game_invitation(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_game_room(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_game_player_state(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_battleship_move(UUID, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.game_has_line(JSONB, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_game_move(UUID, INTEGER, JSONB, UUID, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_game_rematch(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_game_rematch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_game_invite_targets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_game_invitation(TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_game_invitation(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_game_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_player_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_battleship_move(UUID, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_game_move(UUID, INTEGER, JSONB, UUID, TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_game_rematch(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_game_rematch(UUID) TO authenticated;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.game_invitations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rematch_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

