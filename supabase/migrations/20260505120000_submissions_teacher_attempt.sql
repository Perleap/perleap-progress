-- Teacher preview / simulator submissions (same UID as teacher, flagged for grading UI)
-- Apply on the linked Supabase project (e.g. supabase db push). If POST /submissions returns 403 with
-- is_teacher_attempt: true, this migration is missing or PostgREST schema cache is stale — run
-- NOTIFY pgrst, 'reload schema'; in SQL. For app-admin previews across any classroom, apply
-- 20260506120000_submissions_teacher_try_app_admin.sql after this file.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS is_teacher_attempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.submissions.is_teacher_attempt IS
  'True when the owning user_id (student_id) is the classroom teacher exercising Try assignment / preview flow.';

-- Student inserts must never set the teacher-preview flag (prevents spoofing).
DROP POLICY IF EXISTS "submissions_insert_student" ON public.submissions;
CREATE POLICY "submissions_insert_student" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (select auth.uid())
    AND COALESCE(is_teacher_attempt, false) = false
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
        AND a.active = true
        AND c.active = true
        AND public.check_is_enrolled((select auth.uid()), c.id)
    )
  );

CREATE POLICY "submissions_insert_teacher_try" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (select auth.uid())
    AND COALESCE(is_teacher_attempt, false) = true
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
        AND c.teacher_id = (select auth.uid())
        AND a.active = true
        AND c.active = true
    )
  );

NOTIFY pgrst, 'reload schema';
