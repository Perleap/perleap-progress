-- Assignment time tracking: wall-clock duration per submission attempt
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

COMMENT ON COLUMN public.submissions.started_at IS 'When this attempt row was created (student started working).';
COMMENT ON COLUMN public.submissions.duration_seconds IS 'Wall-clock seconds from started_at to submit; set when status becomes completed.';

ALTER TABLE public.student_nuance_metrics
  ADD COLUMN IF NOT EXISTS assignment_duration_seconds integer;

COMMENT ON COLUMN public.student_nuance_metrics.assignment_duration_seconds IS 'Wall-clock seconds from attempt start to submit (latest completed non-teacher attempt).';
