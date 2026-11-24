-- Límite TMDB por usuario, compartido entre todas las instancias serverless.
-- Un único contador por cuenta evita conservar historial o términos buscados.
CREATE TABLE IF NOT EXISTS public.tmdb_rate_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 1 AND 41)
);

ALTER TABLE public.tmdb_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tmdb_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tmdb_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_tmdb_request(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;

  INSERT INTO public.tmdb_rate_limits (user_id, window_started_at, request_count)
  VALUES (p_user_id, v_now, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    window_started_at = CASE
      WHEN public.tmdb_rate_limits.window_started_at <= v_now - INTERVAL '60 seconds' THEN v_now
      ELSE public.tmdb_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN public.tmdb_rate_limits.window_started_at <= v_now - INTERVAL '60 seconds' THEN 1
      ELSE LEAST(public.tmdb_rate_limits.request_count + 1, 41)
    END
  RETURNING request_count INTO v_count;

  RETURN v_count <= 40;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_tmdb_request(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_tmdb_request(UUID) TO service_role;
