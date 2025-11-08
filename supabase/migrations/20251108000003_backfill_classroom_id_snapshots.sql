-- Backfill classroom_id for existing five_d_snapshots
-- This associates historical snapshots with their correct classroom based on the submission's assignment

-- Update snapshots that have a submission_id
-- by tracing: snapshot -> submission -> assignment -> classroom
UPDATE public.five_d_snapshots
SET classroom_id = (
  SELECT a.classroom_id
  FROM public.submissions s
  INNER JOIN public.assignments a ON a.id = s.assignment_id
  WHERE s.id = five_d_snapshots.submission_id
)
WHERE five_d_snapshots.classroom_id IS NULL
  AND five_d_snapshots.submission_id IS NOT NULL;

-- Log how many rows were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled classroom_id for % snapshots', updated_count;
END $$;

-- Add a comment
COMMENT ON COLUMN public.five_d_snapshots.classroom_id IS 
  'Links the snapshot to a specific classroom. Backfilled from submission->assignment->classroom relationship for historical data.';

