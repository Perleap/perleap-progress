-- Align test_questions / test_responses teacher policies with is_classroom_teacher + app admins.

DROP POLICY IF EXISTS "Teachers can manage test questions for their assignments" ON public.test_questions;
DROP POLICY IF EXISTS "Teachers can read test responses for their assignments" ON public.test_responses;

CREATE POLICY "Teachers can manage test questions for their assignments"
  ON public.test_questions
  FOR ALL
  TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = test_questions.assignment_id
        AND public.is_classroom_teacher(a.classroom_id, (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = test_questions.assignment_id
        AND public.is_classroom_teacher(a.classroom_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Teachers can read test responses for their assignments"
  ON public.test_responses
  FOR SELECT
  TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.id = test_responses.submission_id
        AND public.is_classroom_teacher(a.classroom_id, (SELECT auth.uid()))
    )
  );
