-- Allow classroom teachers to read assignment_conversations for submissions in their classes
-- (student policy remains: student_id = auth.uid())

CREATE POLICY "assignment_conversations_select_teacher" ON public.assignment_conversations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_conversations.assignment_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

COMMENT ON POLICY "assignment_conversations_select_teacher" ON public.assignment_conversations IS
  'Teachers can view chat transcripts for assignments in their classrooms.';
