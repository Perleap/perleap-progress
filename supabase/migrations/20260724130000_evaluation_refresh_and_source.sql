-- evaluation_source on assignment_feedback + evaluation_refresh_batches for Undo

ALTER TABLE public.assignment_feedback
  ADD COLUMN IF NOT EXISTS evaluation_source text;

COMMENT ON COLUMN public.assignment_feedback.evaluation_source IS
  'ai_student_work = generate-feedback; teacher_manual = evaluate-from-feedback (Write Evaluation). Refresh skips teacher_manual.';

ALTER TABLE public.assignment_feedback
  DROP CONSTRAINT IF EXISTS assignment_feedback_evaluation_source_check;

ALTER TABLE public.assignment_feedback
  ADD CONSTRAINT assignment_feedback_evaluation_source_check
  CHECK (evaluation_source IS NULL OR evaluation_source IN ('ai_student_work', 'teacher_manual'));

-- Legacy backfill: evaluate-from-feedback inserts empty conversation_context
UPDATE public.assignment_feedback
SET evaluation_source = 'teacher_manual'
WHERE evaluation_source IS NULL
  AND conversation_context = '[]'::jsonb;

UPDATE public.assignment_feedback
SET evaluation_source = 'ai_student_work'
WHERE evaluation_source IS NULL;

CREATE TABLE IF NOT EXISTS public.evaluation_refresh_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  backups jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_refresh_batches_classroom
  ON public.evaluation_refresh_batches (classroom_id);

COMMENT ON TABLE public.evaluation_refresh_batches IS
  'Latest AI evaluation refresh backup per classroom for Undo (one row per classroom).';

ALTER TABLE public.evaluation_refresh_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evaluation_refresh_batches_select" ON public.evaluation_refresh_batches;
CREATE POLICY "evaluation_refresh_batches_select" ON public.evaluation_refresh_batches
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = evaluation_refresh_batches.classroom_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "evaluation_refresh_batches_all_service" ON public.evaluation_refresh_batches;
CREATE POLICY "evaluation_refresh_batches_all_service" ON public.evaluation_refresh_batches
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
