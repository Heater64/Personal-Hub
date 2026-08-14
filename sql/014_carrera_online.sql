-- ==========================================
-- PERSONAL HUB — 14. MODO CARRERA (juegos online simultáneos)
--
-- Diferencia con el "modo reto" (submit_score_move, por turnos):
--   · En el modo reto cada jugador juega su turno y gana el de más puntos.
--   · En la CARRERA los dos jugadores juegan A LA VEZ, cada uno su
--     tablero/partida, y en cuanto UNO termina la sala se cierra y se
--     muestra quién ha sido más rápido. El servidor arbitra:
--       1. El primer jugador en enviar su resultado → la carrera acaba,
--          ese jugador es el ganador (result = { race: true }).
--       2. Si el rival también termina (su envío llega justo después),
--          se registra su resultado para que la pantalla compare los
--          dos tiempos; si su tiempo es MEJOR, el ganador se actualiza
--          (quien fue más rápido gana).
--
-- Estado por sala: { scores: [p0, p1], times: [t0, t1], turn, winner, draw }
--   · scores[i] → puntuación del jugador i (Memoria: movimientos)
--   · times[i]  → tiempo del jugador i en segundos (quién fue más rápido)
--
-- Pega TODO en el SQL Editor y ejecútalo UNA vez. Idempotente.
-- ==========================================

-- ==========================================
-- 1. SUBMIT_RACE_RESULT — registrar el resultado de un jugador en carrera
--    A diferencia de submit_score_move, NO exige turno: ambos pueden
--    jugar simultáneamente. El primero en terminar cierra la carrera.
-- ==========================================
CREATE OR REPLACE FUNCTION public.submit_race_result(
  p_room_id UUID,
  p_expected_revision INTEGER,
  p_score INTEGER,
  p_time INTEGER,
  p_result JSONB DEFAULT '{}'::jsonb
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
  times JSONB;
  rival_time INTEGER;
  new_state JSONB;
  is_race_finish BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > 1000000000 THEN RAISE EXCEPTION 'Puntuación no válida.'; END IF;
  IF p_time IS NULL OR p_time < 0 OR p_time > 86400 THEN RAISE EXCEPTION 'Tiempo no válido.'; END IF;

  SELECT * INTO room FROM public.game_rooms
    WHERE id = p_room_id
      AND (host_id = auth.uid() OR guest_id = auth.uid())
      AND expires_at > NOW()
      AND revision = p_expected_revision
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La partida cambió. Sincronizando…'; END IF;

  IF room.game_id NOT IN ('2048','agujero-negro','ahorcado','breakout','buscaminas','cuchillos','invaders','laberinto','memoria','meteoritos','pong','simon','snake','tetris','tiroarco','torre') THEN
    RAISE EXCEPTION 'Este juego no admite el modo carrera.';
  END IF;

  -- Solo se puntúa en salas activas, o en una carrera ya terminada por
  -- otro jugador (para que el rival que terminó casi a la vez registre
  -- también su tiempo y la pantalla compare quién fue más rápido).
  is_race_finish := room.status = 'finished' AND COALESCE(room.result->>'race', 'false') = 'true';
  IF room.status <> 'active' AND NOT is_race_finish THEN
    RAISE EXCEPTION 'La partida ya no está activa.';
  END IF;

  me := CASE WHEN room.host_id = auth.uid() THEN 0 ELSE 1 END;
  rival := CASE WHEN me = 0 THEN room.guest_id ELSE room.host_id END;
  IF rival IS NULL THEN RAISE EXCEPTION 'La partida aún no tiene rival.'; END IF;

  scores := COALESCE(room.state->'scores', '[null, null]'::jsonb);
  times  := COALESCE(room.state->'times',  '[null, null]'::jsonb);
  IF jsonb_typeof(scores) <> 'array' OR jsonb_array_length(scores) <> 2 THEN
    scores := '[null, null]'::jsonb;
  END IF;
  IF jsonb_typeof(times) <> 'array' OR jsonb_array_length(times) <> 2 THEN
    times := '[null, null]'::jsonb;
  END IF;

  -- Un jugador no puede enviar su resultado dos veces.
  IF (scores->me) IS NOT NULL AND (scores->me)::text <> 'null' THEN
    RAISE EXCEPTION 'Ya has enviado tu resultado.';
  END IF;

  scores := jsonb_set(scores, ARRAY[me::text], to_jsonb(p_score));
  times  := jsonb_set(times,  ARRAY[me::text], to_jsonb(p_time));

  IF room.status = 'active' THEN
    -- Primer jugador en terminar: la carrera acaba y este jugador gana.
    new_state := jsonb_build_object(
      'scores', scores,
      'times', times,
      'turn', to_jsonb(rival),
      'winner', to_jsonb(me),
      'draw', 'false'::jsonb
    );
    UPDATE public.game_rooms SET state = new_state, status = 'finished',
      winner_id = auth.uid(),
      result = jsonb_build_object('race', true) || COALESCE(p_result, '{}'::jsonb),
      revision = revision + 1, updated_at = NOW()
      WHERE id = room.id RETURNING * INTO updated_room;
  ELSE
    -- Carrera ya terminada: registra el tiempo del segundo jugador y, si
    -- su tiempo es mejor que el del ganador actual, actualiza el ganador
    -- (la pantalla muestra quién fue más rápido).
    rival_time := NULL;
    IF (times->(1-me)) IS NOT NULL AND (times->(1-me))::text <> 'null' THEN
      rival_time := (times->(1-me))::int;
    END IF;

    new_state := jsonb_build_object(
      'scores', scores,
      'times', times,
      'turn', to_jsonb(rival),
      'winner', room.state->'winner',
      'draw', 'false'::jsonb
    );

    IF rival_time IS NOT NULL AND p_time < rival_time THEN
      new_state := jsonb_set(new_state, '{winner}', to_jsonb(me));
      UPDATE public.game_rooms SET state = new_state, status = 'finished',
        winner_id = auth.uid(),
        result = jsonb_build_object('race', true) || COALESCE(p_result, '{}'::jsonb),
        revision = revision + 1, updated_at = NOW()
        WHERE id = room.id RETURNING * INTO updated_room;
    ELSE
      UPDATE public.game_rooms SET state = new_state, status = 'finished',
        result = jsonb_build_object('race', true) || COALESCE(p_result, '{}'::jsonb),
        revision = revision + 1, updated_at = NOW()
        WHERE id = room.id RETURNING * INTO updated_room;
    END IF;
  END IF;
  RETURN updated_room;
END;
$$;

-- ==========================================
-- 2. PERMISOS
-- ==========================================
REVOKE EXECUTE ON FUNCTION public.submit_race_result(UUID, INTEGER, INTEGER, INTEGER, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_race_result(UUID, INTEGER, INTEGER, INTEGER, JSONB) TO authenticated;
