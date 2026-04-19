-- ============================================================================
-- Module flow steps + student progress + resource_type 'lesson' (text+video)
-- ============================================================================

-- 1. Extend section_resources: 'lesson' type + optional content check for lesson rows
ALTER TABLE public.section_resources
  DROP CONSTRAINT IF EXISTS section_resources_resource_type_check;

ALTER TABLE public.section_resources
  ADD CONSTRAINT section_resources_resource_type_check
  CHECK (resource_type IN ('file', 'video', 'link', 'document', 'image', 'text', 'lesson'));

COMMENT ON COLUMN public.section_resources.resource_type IS 'lesson = combined text (body_text) and/or video (url or file_path); at least one must be set.';

ALTER TABLE public.section_resources
  DROP CONSTRAINT IF EXISTS section_resources_lesson_has_content;

ALTER TABLE public.section_resources
  ADD CONSTRAINT section_resources_lesson_has_content
  CHECK (
    resource_type <> 'lesson'
    OR (
      (body_text IS NOT NULL AND btrim(body_text) <> '')
      OR file_path IS NOT NULL
      OR (url IS NOT NULL AND btrim(url) <> '')
    )
  );

-- 2. module_flow_steps: ordered mix of section_resources and assignments per module
CREATE TABLE public.module_flow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.syllabus_sections(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  step_kind text NOT NULL CHECK (step_kind IN ('resource', 'assignment')),
  section_resource_id uuid REFERENCES public.section_resources(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_flow_steps_one_target CHECK (
    (step_kind = 'resource' AND section_resource_id IS NOT NULL AND assignment_id IS NULL)
    OR (step_kind = 'assignment' AND assignment_id IS NOT NULL AND section_resource_id IS NULL)
  ),
  CONSTRAINT module_flow_steps_section_order_unique UNIQUE (section_id, order_index)
);

CREATE INDEX idx_module_flow_steps_section_id ON public.module_flow_steps(section_id);

CREATE TRIGGER set_updated_at_module_flow_steps
  BEFORE UPDATE ON public.module_flow_steps
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.validate_module_flow_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res_section uuid;
  asgn_section uuid;
BEGIN
  IF NEW.step_kind = 'resource' THEN
    SELECT section_id INTO res_section FROM public.section_resources WHERE id = NEW.section_resource_id;
    IF res_section IS NULL OR res_section <> NEW.section_id THEN
      RAISE EXCEPTION 'module_flow_steps: section_resource must belong to section_id';
    END IF;
  ELSIF NEW.step_kind = 'assignment' THEN
    SELECT syllabus_section_id INTO asgn_section FROM public.assignments WHERE id = NEW.assignment_id;
    IF asgn_section IS NULL OR asgn_section <> NEW.section_id THEN
      RAISE EXCEPTION 'module_flow_steps: assignment must belong to section_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_module_flow_steps_validate
  BEFORE INSERT OR UPDATE ON public.module_flow_steps
  FOR EACH ROW EXECUTE FUNCTION public.validate_module_flow_step();

-- 3. student_module_flow_progress
CREATE TABLE public.student_module_flow_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_flow_step_id uuid NOT NULL REFERENCES public.module_flow_steps(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, module_flow_step_id)
);

CREATE INDEX idx_student_module_flow_progress_student ON public.student_module_flow_progress(student_id);
CREATE INDEX idx_student_module_flow_progress_step ON public.student_module_flow_progress(module_flow_step_id);

CREATE TRIGGER set_updated_at_student_module_flow_progress
  BEFORE UPDATE ON public.student_module_flow_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. RLS
ALTER TABLE public.module_flow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage module flow steps"
  ON public.module_flow_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND public.is_classroom_teacher(s.classroom_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND public.is_classroom_teacher(s.classroom_id, auth.uid())
    )
  );

CREATE POLICY "Students can view module flow for published syllabi"
  ON public.module_flow_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, auth.uid())
    )
  );

ALTER TABLE public.student_module_flow_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own module flow progress"
  ON public.student_module_flow_progress FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view student module flow progress"
  ON public.student_module_flow_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.module_flow_steps mfs
      JOIN public.syllabus_sections ss ON ss.id = mfs.section_id
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE mfs.id = module_flow_step_id
        AND public.is_classroom_teacher(s.classroom_id, auth.uid())
    )
  );
