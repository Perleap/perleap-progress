-- Repair: migration 20260503120000 was recorded but table/DDL never landed on this DB (42P01).
-- Idempotent policies for safe re-run.

CREATE TABLE IF NOT EXISTS public.assignment_chat_sentence_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  message_index integer NOT NULL CHECK (message_index >= 0),
  sentence_index integer NOT NULL CHECK (sentence_index >= 0),
  sentence_text text NOT NULL,
  CONSTRAINT assignment_chat_sentence_flags_sub_msg_sentence_uq
    UNIQUE (submission_id, message_index, sentence_index)
);

CREATE INDEX IF NOT EXISTS idx_assignment_chat_sentence_flags_submission
  ON public.assignment_chat_sentence_flags (submission_id, created_at DESC);

ALTER TABLE public.assignment_chat_sentence_flags ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.assignment_chat_sentence_flags FROM anon, authenticated;
GRANT SELECT ON public.assignment_chat_sentence_flags TO authenticated;

DROP POLICY IF EXISTS "assignment_chat_sentence_flags_select_student"
  ON public.assignment_chat_sentence_flags;
CREATE POLICY "assignment_chat_sentence_flags_select_student"
  ON public.assignment_chat_sentence_flags
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "assignment_chat_sentence_flags_select_teacher"
  ON public.assignment_chat_sentence_flags;
CREATE POLICY "assignment_chat_sentence_flags_select_teacher"
  ON public.assignment_chat_sentence_flags
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_chat_sentence_flags.assignment_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
