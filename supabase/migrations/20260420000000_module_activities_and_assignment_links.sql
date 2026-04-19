-- ============================================================================
-- Module activities (section_resources) + assignment_module_activities junction
-- ============================================================================

-- 1. Extend section_resources: activity fields and resource_type 'text'
ALTER TABLE public.section_resources
  DROP CONSTRAINT IF EXISTS section_resources_resource_type_check;

ALTER TABLE public.section_resources
  ADD CONSTRAINT section_resources_resource_type_check
  CHECK (resource_type IN ('file', 'video', 'link', 'document', 'image', 'text'));

ALTER TABLE public.section_resources
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published')),
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer;

COMMENT ON COLUMN public.section_resources.body_text IS 'Rich text / markdown for text-type activities; syllabus_sections.content is module overview.';
COMMENT ON COLUMN public.section_resources.status IS 'draft = teacher-only; published = visible to students when syllabus is published.';

-- 2. Junction: assignments <-> section_resources (module activities for AI + product)
CREATE TABLE public.assignment_module_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  section_resource_id uuid NOT NULL REFERENCES public.section_resources(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  include_in_ai_context boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, section_resource_id)
);

CREATE INDEX idx_assignment_module_activities_assignment_id
  ON public.assignment_module_activities(assignment_id);
CREATE INDEX idx_assignment_module_activities_section_resource_id
  ON public.assignment_module_activities(section_resource_id);

-- 3. Enforce: linked resource must belong to assignment's syllabus section
CREATE OR REPLACE FUNCTION public.check_assignment_module_activity_section()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid uuid;
BEGIN
  SELECT syllabus_section_id INTO sid FROM public.assignments WHERE id = NEW.assignment_id;
  IF sid IS NULL THEN
    RAISE EXCEPTION 'Assignment has no syllabus_section_id; cannot link module activities';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.section_resources sr
    WHERE sr.id = NEW.section_resource_id AND sr.section_id = sid
  ) THEN
    RAISE EXCEPTION 'section_resource does not belong to assignment syllabus section';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignment_module_activities_section_check
  BEFORE INSERT OR UPDATE ON public.assignment_module_activities
  FOR EACH ROW EXECUTE FUNCTION public.check_assignment_module_activity_section();

-- 4. RLS on assignment_module_activities
ALTER TABLE public.assignment_module_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage assignment module activities"
  ON public.assignment_module_activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND public.is_classroom_teacher(a.classroom_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND public.is_classroom_teacher(a.classroom_id, auth.uid())
    )
  );

CREATE POLICY "Students can view assignment module activity links for enrolled classrooms"
  ON public.assignment_module_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND public.is_enrolled_in_classroom(a.classroom_id, auth.uid())
    )
  );

-- 5. Students: only published section_resources (draft hidden)
DROP POLICY IF EXISTS "Students can view resources for published syllabi" ON public.section_resources;

CREATE POLICY "Students can view resources for published syllabi"
  ON public.section_resources FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, auth.uid())
    )
  );

-- 6. Backfill: link all section resources to assignments in the same section
INSERT INTO public.assignment_module_activities (assignment_id, section_resource_id, order_index, include_in_ai_context)
SELECT a.id, sr.id, sr.order_index, true
FROM public.assignments a
JOIN public.section_resources sr ON sr.section_id = a.syllabus_section_id
WHERE a.syllabus_section_id IS NOT NULL
ON CONFLICT (assignment_id, section_resource_id) DO NOTHING;
