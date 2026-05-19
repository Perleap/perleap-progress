-- Distilled per-student course memory: facts across all syllabus sections in a classroom.
-- Layered with student_section_unit_memory (same-unit recall). Written by Edge Functions.

CREATE TABLE IF NOT EXISTS public.student_classroom_course_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  processed_submission_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_classroom_course_memory_unique
    UNIQUE (student_id, classroom_id)
);

CREATE INDEX IF NOT EXISTS idx_student_classroom_course_memory_lookup
  ON public.student_classroom_course_memory (student_id, classroom_id);

CREATE INDEX IF NOT EXISTS idx_student_classroom_course_memory_classroom
  ON public.student_classroom_course_memory (classroom_id);

COMMENT ON TABLE public.student_classroom_course_memory IS
  'Distilled factual memory per student per classroom (whole course). facts[] includes syllabus_section_id for cross-unit recall.';

COMMENT ON COLUMN public.student_classroom_course_memory.facts IS
  'JSON array: [{ id, submission_id, assignment_id, assignment_title, text, extracted_at, syllabus_section_id, syllabus_section_title? }]';

COMMENT ON COLUMN public.student_classroom_course_memory.processed_submission_ids IS
  'UUID strings of submissions already handled by extraction (idempotency independent of facts cap).';

DROP TRIGGER IF EXISTS update_student_classroom_course_memory_updated_at ON public.student_classroom_course_memory;
CREATE TRIGGER update_student_classroom_course_memory_updated_at
  BEFORE UPDATE ON public.student_classroom_course_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_classroom_course_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_classroom_course_memory_select_student" ON public.student_classroom_course_memory;
CREATE POLICY "student_classroom_course_memory_select_student"
  ON public.student_classroom_course_memory
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "student_classroom_course_memory_select_teacher" ON public.student_classroom_course_memory;
CREATE POLICY "student_classroom_course_memory_select_teacher"
  ON public.student_classroom_course_memory
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classrooms c
      WHERE c.id = student_classroom_course_memory.classroom_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "student_classroom_course_memory_select_app_admin" ON public.student_classroom_course_memory;
CREATE POLICY "student_classroom_course_memory_select_app_admin"
  ON public.student_classroom_course_memory
  FOR SELECT TO authenticated
  USING (public.is_app_admin((SELECT auth.uid())));

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS use_course_memory BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.assignments.use_course_memory IS
  'When true, completed work contributes to and later assignments may load cross-unit course memory.';

NOTIFY pgrst, 'reload schema';
