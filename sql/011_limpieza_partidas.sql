-- ==========================================
-- 011_LIMPIEZA_PARTIDAS.SQL — No acumular historial
-- Conserva solo las 5 partidas terminadas más recientes por pareja.
-- Limpia salas en espera caducadas e invitaciones viejas resueltas.
-- ==========================================

-- Poda idempotente y barata (tabla pequeña: 2 usuarios).
CREATE OR REPLACE FUNCTION public.prune_game_history() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  pair RECORD;
BEGIN
  -- Partidas terminadas: conservar solo las 5 más recientes por pareja.
  FOR pair IN
    SELECT host_id, guest_id FROM public.game_rooms
    WHERE status = 'finished' AND guest_id IS NOT NULL
    GROUP BY host_id, guest_id
  LOOP
    DELETE FROM public.game_rooms
    WHERE host_id = pair.host_id AND guest_id = pair.guest_id AND status = 'finished'
      AND id NOT IN (
        SELECT id FROM public.game_rooms
        WHERE host_id = pair.host_id AND guest_id = pair.guest_id AND status = 'finished'
        ORDER BY updated_at DESC, created_at DESC, id DESC
        LIMIT 5
      );
  END LOOP;

  -- Salas en espera caducadas (nadie aceptó la invitación).
  DELETE FROM public.game_rooms
  WHERE status = 'waiting' AND expires_at < NOW();

  -- Salas activas o canceladas sin actividad en 24 h (partida abandonada).
  DELETE FROM public.game_rooms
  WHERE status IN ('active', 'cancelled') AND updated_at < NOW() - INTERVAL '24 hours';

  -- Invitaciones resueltas con más de 7 días (basura acumulada).
  DELETE FROM public.game_invitations
  WHERE status <> 'pending' AND updated_at < NOW() - INTERVAL '7 days';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_game_history ON public.game_rooms;
CREATE TRIGGER trg_prune_game_history
AFTER INSERT OR UPDATE ON public.game_rooms
FOR EACH ROW
EXECUTE FUNCTION public.prune_game_history();
