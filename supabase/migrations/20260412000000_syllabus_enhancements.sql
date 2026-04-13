-- ============================================================================
-- Syllabus enhancements: section_resources, student_section_progress,
-- syllabus customization, teacher completion_status, changelog, comments
-- ============================================================================

-- 1. Customization columns on syllabi
ALTER TABLE public.syllabi
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS section_label_override text,
  ADD COLUMN IF NOT EXISTS custom_settings jsonb NOT NULL DEFAULT '{}';

-- 2. Teacher completion_status on syllabus_sections
ALTER TABLE public.syllabus_sections
  ADD COLUMN IF NOT EXISTS completion_status text NOT NULL DEFAULT 'auto'
    CHECK (completion_status IN ('auto', 'completed', 'skipped'));

-- 3. section_resources table
CREATE TABLE public.section_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.syllabus_sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  resource_type text NOT NULL DEFAULT 'file'
    CHECK (resource_type IN ('file', 'video', 'link', 'document', 'image')),
  file_path text,
  url text,
  mime_type text,
  file_size bigint,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_section_resources_section_id ON public.section_resources(section_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.section_resources
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. student_section_progress table
CREATE TABLE public.student_section_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.syllabus_sections(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'reviewed', 'completed')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, student_id)
);

CREATE INDEX idx_student_section_progress_section_id ON public.student_section_progress(section_id);
CREATE INDEX idx_student_section_progress_student_id ON public.student_section_progress(student_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.student_section_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. syllabus_changelog table
CREATE TABLE public.syllabus_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id uuid NOT NULL REFERENCES public.syllabi(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  change_summary text NOT NULL,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syllabus_changelog_syllabus_id ON public.syllabus_changelog(syllabus_id);

-- 6. section_comments table
CREATE TABLE public.section_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.syllabus_sections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES public.section_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_section_comments_section_id ON public.section_comments(section_id);
CREATE INDEX idx_section_comments_parent_id ON public.section_comments(parent_id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.section_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.section_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_section_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_comments ENABLE ROW LEVEL SECURITY;

-- section_resources: teachers manage, students view on published
CREATE POLICY "Teachers can manage section resources"
  ON public.section_resources FOR ALL
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

CREATE POLICY "Students can view resources for published syllabi"
  ON public.section_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, auth.uid())
    )
  );

-- student_section_progress: students manage their own, teachers view all
CREATE POLICY "Students can manage their own progress"
  ON public.student_section_progress FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view student progress"
  ON public.student_section_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND public.is_classroom_teacher(s.classroom_id, auth.uid())
    )
  );

-- syllabus_changelog: teachers manage, students view on published
CREATE POLICY "Teachers can manage changelog"
  ON public.syllabus_changelog FOR ALL
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

CREATE POLICY "Students can view changelog for published syllabi"
  ON public.syllabus_changelog FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, auth.uid())
    )
  );

-- section_comments: enrolled students + teacher can manage
CREATE POLICY "Teachers can manage section comments"
  ON public.section_comments FOR ALL
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

CREATE POLICY "Students can create and view comments on published syllabi"
  ON public.section_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, auth.uid())
    )
    AND user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, auth.uid())
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Students can view all comments on published syllabi sections"
  ON public.section_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, auth.uid())
    )
  );
