-- ============================================================================
-- Rename section_resources -> activity_list + soft delete (active + deleted_at)
-- on core teaching graph: classrooms, syllabi, syllabus_sections, assignments,
-- enrollments, activity_list.
-- Teacher feed table activity_events is unchanged.
-- ============================================================================

-- 1. Soft-delete columns + pairing CHECK (before table rename)
ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.classrooms DROP CONSTRAINT IF EXISTS classrooms_active_deleted_at_chk;
ALTER TABLE public.classrooms ADD CONSTRAINT classrooms_active_deleted_at_chk
  CHECK ((active = true AND deleted_at IS NULL) OR (active = false AND deleted_at IS NOT NULL));

ALTER TABLE public.syllabi
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.syllabi DROP CONSTRAINT IF EXISTS syllabi_active_deleted_at_chk;
ALTER TABLE public.syllabi ADD CONSTRAINT syllabi_active_deleted_at_chk
  CHECK ((active = true AND deleted_at IS NULL) OR (active = false AND deleted_at IS NOT NULL));

ALTER TABLE public.syllabus_sections
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.syllabus_sections DROP CONSTRAINT IF EXISTS syllabus_sections_active_deleted_at_chk;
ALTER TABLE public.syllabus_sections ADD CONSTRAINT syllabus_sections_active_deleted_at_chk
  CHECK ((active = true AND deleted_at IS NULL) OR (active = false AND deleted_at IS NOT NULL));

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_active_deleted_at_chk;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_active_deleted_at_chk
  CHECK ((active = true AND deleted_at IS NULL) OR (active = false AND deleted_at IS NOT NULL));

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_active_deleted_at_chk;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_active_deleted_at_chk
  CHECK ((active = true AND deleted_at IS NULL) OR (active = false AND deleted_at IS NOT NULL));

ALTER TABLE public.section_resources
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.section_resources DROP CONSTRAINT IF EXISTS section_resources_active_deleted_at_chk;
ALTER TABLE public.section_resources ADD CONSTRAINT section_resources_active_deleted_at_chk
  CHECK ((active = true AND deleted_at IS NULL) OR (active = false AND deleted_at IS NOT NULL));

-- Backfill (explicit)
UPDATE public.classrooms SET active = true, deleted_at = NULL WHERE deleted_at IS NULL AND active IS NOT TRUE;
UPDATE public.syllabi SET active = true, deleted_at = NULL WHERE deleted_at IS NULL AND active IS NOT TRUE;
UPDATE public.syllabus_sections SET active = true, deleted_at = NULL WHERE deleted_at IS NULL AND active IS NOT TRUE;
UPDATE public.assignments SET active = true, deleted_at = NULL WHERE deleted_at IS NULL AND active IS NOT TRUE;
UPDATE public.enrollments SET active = true, deleted_at = NULL WHERE deleted_at IS NULL AND active IS NOT TRUE;
UPDATE public.section_resources SET active = true, deleted_at = NULL WHERE deleted_at IS NULL AND active IS NOT TRUE;

-- 2. Enrollments: allow re-enroll after soft-unenroll
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_classroom_id_student_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS enrollments_active_classroom_student_unique
  ON public.enrollments (classroom_id, student_id)
  WHERE active = true;

-- 3. Rename curriculum resources table -> activity_list
ALTER TABLE public.section_resources RENAME TO activity_list;

ALTER INDEX IF EXISTS public.idx_section_resources_section_id RENAME TO idx_activity_list_section_id;

-- 4. assignment_module_activities: rename FK column (FK follows renamed referenced table + column)
ALTER TABLE public.assignment_module_activities
  RENAME COLUMN section_resource_id TO activity_list_id;

ALTER INDEX IF EXISTS public.idx_assignment_module_activities_section_resource_id
  RENAME TO idx_assignment_module_activities_activity_list_id;

-- 5. module_flow_steps
ALTER TABLE public.module_flow_steps
  RENAME COLUMN section_resource_id TO activity_list_id;

ALTER TABLE public.module_flow_steps DROP CONSTRAINT IF EXISTS module_flow_steps_one_target;
ALTER TABLE public.module_flow_steps ADD CONSTRAINT module_flow_steps_one_target CHECK (
  (step_kind = 'resource' AND activity_list_id IS NOT NULL AND assignment_id IS NULL)
  OR (step_kind = 'assignment' AND assignment_id IS NOT NULL AND activity_list_id IS NULL)
);

-- 6. Functions referencing old names
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
    SELECT 1 FROM public.activity_list sr
    WHERE sr.id = NEW.activity_list_id AND sr.section_id = sid
  ) THEN
    RAISE EXCEPTION 'activity_list row does not belong to assignment syllabus section';
  END IF;

  RETURN NEW;
END;
$$;

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
    SELECT section_id INTO res_section FROM public.activity_list WHERE id = NEW.activity_list_id;
    IF res_section IS NULL OR res_section <> NEW.section_id THEN
      RAISE EXCEPTION 'module_flow_steps: activity_list row must belong to section_id';
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

-- 7. Security definer helpers (used by RLS)
CREATE OR REPLACE FUNCTION public.check_is_enrolled(student_uuid uuid, classroom_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.classrooms c ON c.id = e.classroom_id
    WHERE e.student_id = student_uuid
      AND e.classroom_id = classroom_uuid
      AND e.active = true
      AND c.active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_owns_classroom(teacher_uuid uuid, classroom_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.classrooms
    WHERE id = classroom_uuid
      AND teacher_id = teacher_uuid
      AND active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_teacher_of_student(teacher_uuid uuid, student_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.classrooms c
    JOIN public.enrollments e ON e.classroom_id = c.id
    WHERE c.teacher_id = teacher_uuid
      AND e.student_id = student_uuid
      AND c.active = true
      AND e.active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled_in_classroom(_classroom_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments e
    JOIN public.classrooms c ON c.id = e.classroom_id
    WHERE e.classroom_id = _classroom_id
      AND e.student_id = _user_id
      AND e.active = true
      AND c.active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_classroom_teacher(_classroom_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classrooms
    WHERE id = _classroom_id
      AND teacher_id = _user_id
      AND active = true
  );
$$;

-- 8. RLS: classrooms (invite flow + enrolled + teacher)
DROP POLICY IF EXISTS "classrooms_select" ON public.classrooms;
CREATE POLICY "classrooms_select" ON public.classrooms
  FOR SELECT TO authenticated
  USING (
    active = true
    AND (
      teacher_id = (select auth.uid())
      OR public.check_is_enrolled((select auth.uid()), id)
      OR invite_code IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "classrooms_delete" ON public.classrooms;

DROP POLICY IF EXISTS "enrollments_select" ON public.enrollments;
CREATE POLICY "enrollments_select" ON public.enrollments
  FOR SELECT TO authenticated
  USING (
    active = true AND (
      student_id = (select auth.uid()) OR
      public.check_owns_classroom((select auth.uid()), classroom_id)
    )
  );

DROP POLICY IF EXISTS "enrollments_update_student" ON public.enrollments;
CREATE POLICY "enrollments_update_student" ON public.enrollments
  FOR UPDATE TO authenticated
  USING (student_id = (select auth.uid()) AND active = true)
  WITH CHECK (student_id = (select auth.uid()));

DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
CREATE POLICY "assignments_select" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    active = true AND (
      public.check_owns_classroom((select auth.uid()), classroom_id) OR
      (
        status = 'published' AND
        public.check_is_enrolled((select auth.uid()), classroom_id)
      )
    )
  );

DROP POLICY IF EXISTS "assignments_delete_teacher" ON public.assignments;

DROP POLICY IF EXISTS "assignments_insert_teacher" ON public.assignments;
CREATE POLICY "assignments_insert_teacher" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = assignments.classroom_id
        AND c.teacher_id = (select auth.uid())
        AND c.active = true
    )
  );

DROP POLICY IF EXISTS "assignments_update_teacher" ON public.assignments;
CREATE POLICY "assignments_update_teacher" ON public.assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = assignments.classroom_id
        AND c.teacher_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "submissions_select" ON public.submissions;
CREATE POLICY "submissions_select" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
        AND a.active = true
        AND c.active = true
        AND (
          submissions.student_id = (select auth.uid())
          OR c.teacher_id = (select auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "enrollments_insert" ON public.enrollments;
CREATE POLICY "enrollments_insert" ON public.enrollments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (select auth.uid())
    AND active = true
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = enrollments.classroom_id
        AND c.active = true
    )
  );

DROP POLICY IF EXISTS "submissions_insert_student" ON public.submissions;
CREATE POLICY "submissions_insert_student" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
        AND a.active = true
        AND c.active = true
        AND public.check_is_enrolled((select auth.uid()), c.id)
    )
  );

-- Syllabus tables: drop & recreate student-facing SELECT with active chain
DROP POLICY IF EXISTS "Students can view published syllabi for enrolled classrooms" ON public.syllabi;
CREATE POLICY "Students can view published syllabi for enrolled classrooms" ON public.syllabi
  FOR SELECT TO authenticated
  USING (
    active = true
    AND status = 'published'
    AND public.is_enrolled_in_classroom(classroom_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "Students can view sections for published syllabi" ON public.syllabus_sections;
CREATE POLICY "Students can view sections for published syllabi" ON public.syllabus_sections
  FOR SELECT TO authenticated
  USING (
    active = true
    AND EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND s.active = true
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Teachers can manage syllabi for their classrooms" ON public.syllabi;
CREATE POLICY "Teachers can manage syllabi for their classrooms" ON public.syllabi
  FOR ALL TO authenticated
  USING (public.is_classroom_teacher(classroom_id, (select auth.uid())))
  WITH CHECK (public.is_classroom_teacher(classroom_id, (select auth.uid())));

DROP POLICY IF EXISTS "Teachers can manage sections for their syllabi" ON public.syllabus_sections;
CREATE POLICY "Teachers can manage sections for their syllabi" ON public.syllabus_sections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND s.active = true
        AND public.is_classroom_teacher(s.classroom_id, (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.syllabi s
      WHERE s.id = syllabus_id
        AND s.active = true
        AND public.is_classroom_teacher(s.classroom_id, (select auth.uid()))
    )
  );

-- activity_list (renamed section_resources): teacher ALL + student SELECT
DROP POLICY IF EXISTS "Teachers can manage section resources" ON public.activity_list;
CREATE POLICY "Teachers can manage activity_list rows" ON public.activity_list
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND ss.active = true
        AND s.active = true
        AND public.is_classroom_teacher(s.classroom_id, (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND ss.active = true
        AND s.active = true
        AND public.is_classroom_teacher(s.classroom_id, (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Students can view resources for published syllabi" ON public.activity_list;
CREATE POLICY "Students can view published activity_list rows" ON public.activity_list
  FOR SELECT TO authenticated
  USING (
    active = true
    AND status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND ss.active = true
        AND s.active = true
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, (select auth.uid()))
    )
  );

-- assignment_module_activities: tighten SELECT using active flags
DROP POLICY IF EXISTS "Teachers manage assignment module activities" ON public.assignment_module_activities;
CREATE POLICY "Teachers manage assignment module activities" ON public.assignment_module_activities
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.active = true
        AND public.is_classroom_teacher(a.classroom_id, (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.active = true
        AND public.is_classroom_teacher(a.classroom_id, (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Students can view assignment module activity links for enrolled classrooms" ON public.assignment_module_activities;
CREATE POLICY "Students can view assignment module activity links for enrolled classrooms" ON public.assignment_module_activities
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id
        AND a.active = true
        AND public.is_enrolled_in_classroom(a.classroom_id, (select auth.uid()))
    )
  );

-- module_flow_steps
DROP POLICY IF EXISTS "Teachers manage module flow steps" ON public.module_flow_steps;
CREATE POLICY "Teachers manage module flow steps" ON public.module_flow_steps
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND ss.active = true
        AND s.active = true
        AND public.is_classroom_teacher(s.classroom_id, (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND ss.active = true
        AND s.active = true
        AND public.is_classroom_teacher(s.classroom_id, (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Students can view module flow for published syllabi" ON public.module_flow_steps;
CREATE POLICY "Students can view module flow for published syllabi" ON public.module_flow_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.syllabus_sections ss
      JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE ss.id = section_id
        AND ss.active = true
        AND s.active = true
        AND s.status = 'published'
        AND public.is_enrolled_in_classroom(s.classroom_id, (select auth.uid()))
    )
  );

COMMENT ON TABLE public.activity_list IS 'Curriculum module activities (files, lessons, text, etc.); was section_resources. Soft-deleted via active/deleted_at.';
