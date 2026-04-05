-- Per-assignment AI feedback publishing + row visibility for students

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS auto_publish_ai_feedback boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.assignments.auto_publish_ai_feedback IS 'When true, students see AI feedback as soon as generated. When false, teacher must release feedback.';

ALTER TABLE public.assignment_feedback
  ADD COLUMN IF NOT EXISTS visible_to_student boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.assignment_feedback.visible_to_student IS 'When false, student RLS hides this row until teacher releases.';

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS awaiting_teacher_feedback_release boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.submissions.awaiting_teacher_feedback_release IS 'Student-visible: AI feedback exists but teacher has not released it yet.';

-- Backfill existing data
UPDATE public.assignment_feedback SET visible_to_student = true WHERE visible_to_student IS DISTINCT FROM true;
UPDATE public.submissions SET awaiting_teacher_feedback_release = false WHERE awaiting_teacher_feedback_release IS DISTINCT FROM false;

-- RLS: students only see feedback rows released to them
DROP POLICY IF EXISTS "assignment_feedback_select" ON public.assignment_feedback;

CREATE POLICY "assignment_feedback_select" ON public.assignment_feedback
  FOR SELECT TO authenticated
  USING (
    (
      student_id = (select auth.uid())
      AND visible_to_student = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_feedback.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  );

-- Teachers may release AI feedback to students
CREATE POLICY "assignment_feedback_update_teacher" ON public.assignment_feedback
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_feedback.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_feedback.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  );

-- Teachers may update submissions in their classrooms (e.g. release AI feedback flag)
DROP POLICY IF EXISTS "submissions_update_teacher" ON public.submissions;

CREATE POLICY "submissions_update_teacher" ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  );
