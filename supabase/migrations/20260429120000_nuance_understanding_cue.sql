-- Add chat "understanding cue" events and per-assignment count on metrics.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'nuance_event_type'
      AND e.enumlabel = 'understanding_cue'
  ) THEN
    ALTER TYPE public.nuance_event_type ADD VALUE 'understanding_cue';
  END IF;
END;
$migration$;

ALTER TABLE public.student_nuance_metrics
  ADD COLUMN IF NOT EXISTS understanding_cue_count integer NOT NULL DEFAULT 0;
