-- ============================================================================
-- Syllabus feature: syllabi, syllabus_sections, grading_categories
-- ============================================================================

-- 1. syllabi table
CREATE TABLE public.syllabi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  structure_type text NOT NULL DEFAULT 'weeks'
    CHECK (structure_type IN ('weeks', 'units', 'modules')),
  grading_policy_text text,
  attendance_policy_text text,
  late_work_policy_text text,
  communication_policy_text text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syllabi_classroom_id ON public.syllabi(classroom_id);

-- 2. syllabus_sections table
CREATE TABLE public.syllabus_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id uuid NOT NULL REFERENCES public.syllabi(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  objectives text[],
  resources text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syllabus_sections_syllabus_id ON public.syllabus_sections(syllabus_id);

-- 3. grading_categories table
CREATE TABLE public.grading_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id uuid NOT NULL REFERENCES public.syllabi(id) ON DELETE CASCADE,
  name text NOT NULL,
  weight numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_grading_categories_syllabus_id ON public.grading_categories(syllabus_id);

-- 4. Assignment FK columns (nullable, optional linking)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS syllabus_section_id uuid
    REFERENCES public.syllabus_sections(id) ON DELETE SET NULL;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS grading_category_id uuid
    REFERENCES public.grading_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_assignments_syllabus_section_id ON public.assignments(syllabus_section_id);
CREATE INDEX idx_assignments_grading_category_id ON public.assignments(grading_category_id);

-- 5. updated_at triggers (reuse existing handle_updated_at function)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.syllabi
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.syllabus_sections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.grading_categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. RLS
ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_categories ENABLE ROW LEVEL SECURITY;

-- syllabi policies
CREATE POLICY "Teachers can manage syllabi for their classrooms"
  ON public.syllabi FOR ALL
  USING (public.is_classroom_teacher(classroom_id, auth.uid()))
  WITH CHECK (public.is_classroom_teacher(classroom_id, auth.uid()));

CREATE POLICY "Students can view published syllabi for enrolled classrooms"
  ON public.syllabi FOR SELECT
  USING (
    status = 'published'
    AND public.is_enrolled_in_classroom(classroom_id, auth.uid())
  );

-- syllabus_sections policies
CREATE POLICY "Teachers can manage sections for their syllabi"
  ON public.syllabus_sections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND public.is_classroom_teacher(s.classroom_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND public.is_classroom_teacher(s.classroom_id, auth.uid())
    )
  );

CREATE POLICY "Students can view sections for published syllabi"
  ON public.syllabus_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, auth.uid())
    )
  );

-- grading_categories policies
CREATE POLICY "Teachers can manage grading categories for their syllabi"
  ON public.grading_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND public.is_classroom_teacher(s.classroom_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND public.is_classroom_teacher(s.classroom_id, auth.uid())
    )
  );

CREATE POLICY "Students can view grading categories for published syllabi"
  ON public.grading_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, auth.uid())
    )
  );
