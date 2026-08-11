-- ==========================================
-- 010_REVANCHAS.SQL — Notificaciones de revancha
-- 1) Tabla game_rematch_requests (peticiones pendientes, visibles para ambos)
-- 2) request_game_rematch: crea la fila al pedir, la borra al empezar
-- 3) reject_game_rematch: rechazar/cancelar una petición pendiente
-- ==========================================

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

REVOKE EXECUTE ON FUNCTION public.reject_game_rematch(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_game_rematch(UUID) TO authenticated;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rematch_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
