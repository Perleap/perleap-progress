-- Assignment attempt modes + multiple submissions per student per assignment
-- Replaces UNIQUE(assignment_id, student_id) with (assignment_id, student_id, attempt_number)
-- and enforces at most one in_progress row per (assignment_id, student_id).

CREATE TYPE public.assignment_attempt_mode AS ENUM (
  'single',
  'multiple_until_due',
  'multiple_unlimited'
);

ALTER TABLE public.assignments
  ADD COLUMN attempt_mode public.assignment_attempt_mode NOT NULL DEFAULT 'single';

COMMENT ON COLUMN public.assignments.attempt_mode IS
  'single: one submission; multiple_until_due: retries allowed until due_at; multiple_unlimited: no attempt cap (due_at optional for display).';

-- Backfill attempt numbers before dropping the old unique constraint
ALTER TABLE public.submissions
  ADD COLUMN attempt_number integer;

UPDATE public.submissions SET attempt_number = 1 WHERE attempt_number IS NULL;

ALTER TABLE public.submissions
  ALTER COLUMN attempt_number SET NOT NULL;

ALTER TABLE public.submissions
  ALTER COLUMN attempt_number SET DEFAULT 1;

-- Drop legacy unique (name may vary by Postgres version)
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_assignment_id_student_id_key;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_assignment_student_attempt_unique
  UNIQUE (assignment_id, student_id, attempt_number);

CREATE UNIQUE INDEX submissions_one_in_progress_per_student_assignment
  ON public.submissions (assignment_id, student_id)
  WHERE status = 'in_progress';

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_student
  ON public.submissions (assignment_id, student_id);

COMMENT ON COLUMN public.submissions.attempt_number IS
  '1-based attempt index per student per assignment.';

-- Manual QA: apply with `supabase db push` or migration runner; run `npm run test` for best-submission helpers.
