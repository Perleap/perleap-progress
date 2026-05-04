-- Per-submission notes for teachers / app admins only (out-of-platform interaction log).
-- Teacher-triggered new attempt without deleting history (bypasses student-only INSERT RLS).

CREATE TABLE public.submission_teacher_private_notes (
  submission_id UUID NOT NULL PRIMARY KEY
    REFERENCES public.submissions (id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.submission_teacher_private_notes IS
  'Teacher/admin-only notes per submission; not shown to students.';

CREATE OR REPLACE FUNCTION public.set_submission_teacher_private_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER submission_teacher_private_notes_set_updated_at
  BEFORE UPDATE ON public.submission_teacher_private_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_submission_teacher_private_notes_updated_at();

ALTER TABLE public.submission_teacher_private_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submission_teacher_private_notes_select"
  ON public.submission_teacher_private_notes
  FOR SELECT
  TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = submission_teacher_private_notes.submission_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "submission_teacher_private_notes_insert"
  ON public.submission_teacher_private_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = submission_teacher_private_notes.submission_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "submission_teacher_private_notes_update"
  ON public.submission_teacher_private_notes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = submission_teacher_private_notes.submission_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = submission_teacher_private_notes.submission_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "submission_teacher_private_notes_delete"
  ON public.submission_teacher_private_notes
  FOR DELETE
  TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = submission_teacher_private_notes.submission_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

-- Creates next submission attempt for the same student/assignment (preserves prior rows).
CREATE OR REPLACE FUNCTION public.teacher_reset_student_assignment_progress(_submission_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_assignment_id uuid;
  v_student_id uuid;
  v_classroom_teacher uuid;
  v_max_attempt integer;
  v_new_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT s.assignment_id, s.student_id, c.teacher_id
  INTO v_assignment_id, v_student_id, v_classroom_teacher
  FROM public.submissions s
  INNER JOIN public.assignments a ON a.id = s.assignment_id
  INNER JOIN public.classrooms c ON c.id = a.classroom_id
  WHERE s.id = _submission_id;

  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'submission not found';
  END IF;

  IF v_classroom_teacher IS DISTINCT FROM v_actor AND NOT public.is_app_admin(v_actor) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.submissions s2
    WHERE s2.assignment_id = v_assignment_id
      AND s2.student_id = v_student_id
      AND s2.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'student_already_has_draft';
  END IF;

  SELECT COALESCE(MAX(attempt_number), 0)
  INTO v_max_attempt
  FROM public.submissions
  WHERE assignment_id = v_assignment_id
    AND student_id = v_student_id;

  INSERT INTO public.submissions (
    assignment_id,
    student_id,
    attempt_number,
    status,
    is_teacher_attempt
  )
  VALUES (
    v_assignment_id,
    v_student_id,
    v_max_attempt + 1,
    'in_progress',
    false
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.teacher_reset_student_assignment_progress(uuid) IS
  'Classroom teacher or app admin: insert a new in_progress submission row (next attempt).';

GRANT EXECUTE ON FUNCTION public.teacher_reset_student_assignment_progress(uuid) TO authenticated;
