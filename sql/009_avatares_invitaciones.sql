-- ==========================================
-- 009_AVATARES_INVITACIONES.SQL — avatares de perfil coherentes
-- 1) game_invitations.inviter_avatar (foto del invitador en la tarjeta)
-- 2) sync_profile_from_auth: profiles se actualiza al cambiar nombre/avatar
-- 3) create_game_invitation guarda también el avatar del invitador
-- ==========================================

ALTER TABLE public.game_invitations ADD COLUMN IF NOT EXISTS inviter_avatar TEXT NOT NULL DEFAULT '';

-- Sync perfil: al cambiar nombre/avatar/email en auth.users (desde cualquier
-- dispositivo), la tabla profiles se mantiene al día (Admin, rivales, invitaciones).
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    name = COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), name),
    avatar_url = COALESCE(NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''), avatar_url),
    email = COALESCE(NULLIF(NEW.email, ''), email),
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth();

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

REVOKE EXECUTE ON FUNCTION public.create_game_invitation(TEXT, UUID, JSONB) FROM PUBLIC;

-- Backfill para invitaciones pendientes creadas antes de la columna.
CREATE OR REPLACE FUNCTION public.backfill_inviter_avatars()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.game_invitations gi
  SET inviter_avatar = COALESCE((SELECT p.avatar_url FROM public.profiles p WHERE p.id = gi.inviter_id), '')
  WHERE gi.status = 'pending';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_game_invitation(TEXT, UUID, JSONB) TO authenticated;
