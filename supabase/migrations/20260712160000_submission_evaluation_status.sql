-- Track async AI evaluation lifecycle on submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS evaluation_status text
  CHECK (
    evaluation_status IS NULL
    OR evaluation_status IN ('pending', 'processing', 'completed', 'failed')
  );

COMMENT ON COLUMN public.submissions.evaluation_status IS
  'Async AI evaluation state: pending (queued), processing, completed, failed. NULL when no AI eval was requested.';
