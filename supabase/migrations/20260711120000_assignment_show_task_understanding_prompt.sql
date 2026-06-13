ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS show_task_understanding_prompt boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.assignments.show_task_understanding_prompt IS
  'When true, students must confirm they understand the task in a Before you start dialog.';
