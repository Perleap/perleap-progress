-- Multiple dated private notes per submission (replaces single TEXT blob on submission_teacher_private_notes).

CREATE TABLE public.submission_teacher_private_note_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions (id) ON DELETE CASCADE,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.submission_teacher_private_note_entries IS
  'Teacher/admin-only interaction notes; one row per log entry; not shown to students.';

CREATE INDEX submission_teacher_private_note_entries_submission_created_idx
  ON public.submission_teacher_private_note_entries (submission_id, created_at DESC);

INSERT INTO public.submission_teacher_private_note_entries (submission_id, body, created_at, created_by)
SELECT submission_id, notes, updated_at, updated_by
FROM public.submission_teacher_private_notes
WHERE COALESCE(trim(notes), '') <> '';

DROP TABLE public.submission_teacher_private_notes;

ALTER TABLE public.submission_teacher_private_note_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "submission_teacher_private_note_entries_select"
  ON public.submission_teacher_private_note_entries
  FOR SELECT
  TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = submission_teacher_private_note_entries.submission_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "submission_teacher_private_note_entries_insert"
  ON public.submission_teacher_private_note_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = submission_teacher_private_note_entries.submission_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "submission_teacher_private_note_entries_delete"
  ON public.submission_teacher_private_note_entries
  FOR DELETE
  TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = submission_teacher_private_note_entries.submission_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );
