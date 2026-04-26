-- Learner-visible task summary, distinct from instructions (long AI/teacher prompt).
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS student_facing_task TEXT NULL;

COMMENT ON COLUMN public.assignments.student_facing_task IS
  'Short student-facing description of what to do. Generated or edited by teacher; not the full internal AI instructions.';
