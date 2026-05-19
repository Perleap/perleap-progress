-- Distilled per-student unit memory: durable facts extracted from completed assignments
-- within the same classroom + syllabus section. Written by Edge Functions (service role).

CREATE TABLE IF NOT EXISTS public.student_section_unit_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  syllabus_section_id UUID NOT NULL REFERENCES public.syllabus_sections(id) ON DELETE CASCADE,
  facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_section_unit_memory_unique
    UNIQUE (student_id, classroom_id, syllabus_section_id)
);

CREATE INDEX IF NOT EXISTS idx_student_section_unit_memory_lookup
  ON public.student_section_unit_memory (student_id, classroom_id, syllabus_section_id);

CREATE INDEX IF NOT EXISTS idx_student_section_unit_memory_classroom
  ON public.student_section_unit_memory (classroom_id);

COMMENT ON TABLE public.student_section_unit_memory IS
  'Distilled factual memory per student per syllabus section (unit). facts[] holds extraction batches keyed by submission_id.';

COMMENT ON COLUMN public.student_section_unit_memory.facts IS
  'JSON array: [{ id, submission_id, assignment_id, assignment_title, text, extracted_at }]';

DROP TRIGGER IF EXISTS update_student_section_unit_memory_updated_at ON public.student_section_unit_memory;
CREATE TRIGGER update_student_section_unit_memory_updated_at
  BEFORE UPDATE ON public.student_section_unit_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.student_section_unit_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_section_unit_memory_select_student" ON public.student_section_unit_memory;
CREATE POLICY "student_section_unit_memory_select_student"
  ON public.student_section_unit_memory
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "student_section_unit_memory_select_teacher" ON public.student_section_unit_memory;
CREATE POLICY "student_section_unit_memory_select_teacher"
  ON public.student_section_unit_memory
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.classrooms c
      WHERE c.id = student_section_unit_memory.classroom_id
        AND c.teacher_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "student_section_unit_memory_select_app_admin" ON public.student_section_unit_memory;
CREATE POLICY "student_section_unit_memory_select_app_admin"
  ON public.student_section_unit_memory
  FOR SELECT TO authenticated
  USING (public.is_app_admin((SELECT auth.uid())));

NOTIFY pgrst, 'reload schema';
