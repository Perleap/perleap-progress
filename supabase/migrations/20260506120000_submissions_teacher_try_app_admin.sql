-- Allow app admins to insert teacher-preview submissions for any classroom assignment (RLS 403 when admin ≠ classroom.teacher_id)
-- Requires 20260505120000_submissions_teacher_attempt.sql (column is_teacher_attempt + student policy + initial teacher_try policy).

DROP POLICY IF EXISTS "submissions_insert_teacher_try" ON public.submissions;

CREATE POLICY "submissions_insert_teacher_try" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (select auth.uid())
    AND COALESCE(is_teacher_attempt, false) = true
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
        AND a.active = true
        AND c.active = true
        AND (
          c.teacher_id = (select auth.uid())
          OR public.is_app_admin((select auth.uid()))
        )
    )
  );

-- Help API pick up policy shape after deploy (safe no-op if already cached)
NOTIFY pgrst, 'reload schema';
