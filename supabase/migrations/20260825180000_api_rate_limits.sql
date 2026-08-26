-- Per-user API rate limits for OpenAI proxy edge functions (SEC-006).

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  window_start timestamptz NOT NULL,
  window_kind text NOT NULL CHECK (window_kind IN ('minute', 'day')),
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, function_name, window_start, window_kind)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_window_start_idx
  ON public.api_rate_limits (window_start);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.api_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.api_rate_limits FROM anon;
REVOKE ALL ON TABLE public.api_rate_limits FROM authenticated;

CREATE OR REPLACE FUNCTION public.check_and_increment_api_rate_limit(
  p_user_id uuid,
  p_function_name text,
  p_minute_limit integer DEFAULT 30,
  p_day_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minute_start timestamptz;
  v_day_start timestamptz;
  v_minute_count integer;
  v_day_count integer;
BEGIN
  IF p_user_id IS NULL OR p_function_name IS NULL OR length(trim(p_function_name)) = 0 THEN
    RETURN jsonb_build_object('allowed', true);
  END IF;

  v_minute_start := date_trunc('minute', now() AT TIME ZONE 'utc');
  v_day_start := date_trunc('day', now() AT TIME ZONE 'utc');

  INSERT INTO public.api_rate_limits (user_id, function_name, window_start, window_kind, request_count)
  VALUES (p_user_id, p_function_name, v_minute_start, 'minute', 1)
  ON CONFLICT (user_id, function_name, window_start, window_kind)
  DO UPDATE SET request_count = public.api_rate_limits.request_count + 1
  RETURNING request_count INTO v_minute_count;

  IF v_minute_count > p_minute_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'minute',
      'retry_after_seconds', 60 - EXTRACT(SECOND FROM now() AT TIME ZONE 'utc')::integer
    );
  END IF;

  INSERT INTO public.api_rate_limits (user_id, function_name, window_start, window_kind, request_count)
  VALUES (p_user_id, p_function_name, v_day_start, 'day', 1)
  ON CONFLICT (user_id, function_name, window_start, window_kind)
  DO UPDATE SET request_count = public.api_rate_limits.request_count + 1
  RETURNING request_count INTO v_day_count;

  IF v_day_count > p_day_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'day',
      'retry_after_seconds',
        EXTRACT(EPOCH FROM (v_day_start + interval '1 day' - (now() AT TIME ZONE 'utc')))::integer
    );
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_api_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_api_rate_limit(uuid, text, integer, integer) TO service_role;
