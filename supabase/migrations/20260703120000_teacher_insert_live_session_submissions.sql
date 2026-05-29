-- Teachers evaluate live sessions by creating a completed submission row per student.
-- Student-only INSERT policy blocked this; allow classroom teachers for live_session assignments.

DROP POLICY IF EXISTS "submissions_insert_teacher_live_session" ON public.submissions;

CREATE POLICY "submissions_insert_teacher_live_session"
  ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.type = 'live_session'::public.assignment_type
        AND public.is_classroom_teacher(a.classroom_id, auth.uid())
    )
  );
