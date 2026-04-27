-- Historical metrics for admin observability (Health / Traffic charts). Inserts: Edge Functions with service role only.

CREATE TABLE IF NOT EXISTS public.observability_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('management_api', 'vercel', 'probe_aggregate', 'custom')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS observability_metric_snapshots_recorded_at_idx
  ON public.observability_metric_snapshots (recorded_at DESC);

CREATE INDEX IF NOT EXISTS observability_metric_snapshots_source_idx
  ON public.observability_metric_snapshots (source, recorded_at DESC);

ALTER TABLE public.observability_metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "observability_metric_snapshots_select_admin"
  ON public.observability_metric_snapshots
  FOR SELECT TO authenticated
  USING (public.is_app_admin((select auth.uid())));

COMMENT ON TABLE public.observability_metric_snapshots IS 'Sanitized platform metrics; RLS read for app admins; writes via service role from Edge Functions.';
