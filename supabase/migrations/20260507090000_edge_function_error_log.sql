-- Durable Edge Function error/debug rows for in-app Monitoring + optional admin email alerts.
CREATE TABLE IF NOT EXISTS public.edge_function_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,
  level text NOT NULL CHECK (level IN ('error', 'warn', 'info')),
  http_status integer,
  error_message text NOT NULL,
  context jsonb,
  stack_snippet text,
  request_id text,
  email_sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS edge_function_error_log_created_at_idx
  ON public.edge_function_error_log (created_at DESC);

CREATE INDEX IF NOT EXISTS edge_function_error_log_function_created_idx
  ON public.edge_function_error_log (function_name, created_at DESC);

COMMENT ON TABLE public.edge_function_error_log IS 'Errors and optional warnings from Supabase Edge Functions; inserted with service role from function code.';

ALTER TABLE public.edge_function_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edge_function_error_log_select_app_admin"
  ON public.edge_function_error_log
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin((select auth.uid())));

GRANT SELECT ON public.edge_function_error_log TO authenticated;
