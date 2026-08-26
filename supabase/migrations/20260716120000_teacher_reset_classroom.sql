-- Teacher-initiated classroom reset: remove all students and their work while preserving
-- course structure (classroom, assignments, syllabus, activities). Atomic via RPC.

CREATE OR REPLACE FUNCTION public._assert_teacher_can_reset_classroom(p_classroom_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.is_classroom_teacher(p_classroom_id, v_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classrooms
    WHERE id = p_classroom_id
      AND active = true
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'classroom_not_active';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._classroom_reset_scope_counts(p_classroom_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'active_enrollments',
    (
      SELECT count(*)::int
      FROM public.enrollments e
      WHERE e.classroom_id = p_classroom_id
        AND e.active = true
    ),
    'submissions',
    (
      SELECT count(*)::int
      FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      WHERE a.classroom_id = p_classroom_id
    ),
    'module_flow_progress',
    (
      SELECT count(*)::int
      FROM public.student_module_flow_progress smfp
      INNER JOIN public.module_flow_steps mfs ON mfs.id = smfp.module_flow_step_id
      INNER JOIN public.syllabus_sections ss ON ss.id = mfs.section_id
      INNER JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE s.classroom_id = p_classroom_id
    ),
    'section_progress',
    (
      SELECT count(*)::int
      FROM public.student_section_progress ssp
      INNER JOIN public.syllabus_sections ss ON ss.id = ssp.section_id
      INNER JOIN public.syllabi s ON s.id = ss.syllabus_id
      WHERE s.classroom_id = p_classroom_id
    ),
    'memory_and_nuance_rows',
    (
      SELECT (
        (SELECT count(*) FROM public.student_classroom_course_memory WHERE classroom_id = p_classroom_id)
        + (SELECT count(*) FROM public.student_section_unit_memory WHERE classroom_id = p_classroom_id)
        + (SELECT count(*) FROM public.student_nuance_metrics WHERE classroom_id = p_classroom_id)
        + (SELECT count(*) FROM public.student_recommendations WHERE classroom_id = p_classroom_id)
        + (SELECT count(*) FROM public.video_watch_progress WHERE classroom_id = p_classroom_id)
        + (SELECT count(*) FROM public.five_d_snapshots WHERE classroom_id = p_classroom_id)
        + (SELECT count(*) FROM public.pilot_report_snapshots WHERE classroom_id = p_classroom_id)
      )::int
    ),
    'assignments_preserved',
    (
      SELECT count(*)::int
      FROM public.assignments a
      WHERE a.classroom_id = p_classroom_id
        AND a.active = true
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_preview_classroom_reset(p_classroom_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_teacher_can_reset_classroom(p_classroom_id);
  RETURN public._classroom_reset_scope_counts(p_classroom_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_reset_classroom(p_classroom_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_submissions_deleted int := 0;
  v_nuance_events_deleted int := 0;
  v_module_progress_deleted int := 0;
  v_section_progress_deleted int := 0;
  v_section_comments_deleted int := 0;
  v_enrollments_updated int := 0;
  v_assignments_cleared int := 0;
  v_after jsonb;
BEGIN
  PERFORM public._assert_teacher_can_reset_classroom(p_classroom_id);
  v_before := public._classroom_reset_scope_counts(p_classroom_id);

  -- Primary lever: submission delete cascades feedback, chat, evaluations, test_responses, etc.
  DELETE FROM public.submissions s
  USING public.assignments a
  WHERE s.assignment_id = a.id
    AND a.classroom_id = p_classroom_id;
  GET DIAGNOSTICS v_submissions_deleted = ROW_COUNT;

  DELETE FROM public.student_nuance_events sne
  USING public.assignments a
  WHERE sne.assignment_id = a.id
    AND a.classroom_id = p_classroom_id;
  GET DIAGNOSTICS v_nuance_events_deleted = ROW_COUNT;

  DELETE FROM public.student_module_flow_progress smfp
  USING public.module_flow_steps mfs,
        public.syllabus_sections ss,
        public.syllabi s
  WHERE smfp.module_flow_step_id = mfs.id
    AND mfs.section_id = ss.id
    AND ss.syllabus_id = s.id
    AND s.classroom_id = p_classroom_id;
  GET DIAGNOSTICS v_module_progress_deleted = ROW_COUNT;

  DELETE FROM public.student_section_progress ssp
  USING public.syllabus_sections ss,
        public.syllabi s
  WHERE ssp.section_id = ss.id
    AND ss.syllabus_id = s.id
    AND s.classroom_id = p_classroom_id;
  GET DIAGNOSTICS v_section_progress_deleted = ROW_COUNT;

  DELETE FROM public.student_nuance_metrics
  WHERE classroom_id = p_classroom_id;

  DELETE FROM public.student_recommendations
  WHERE classroom_id = p_classroom_id;

  DELETE FROM public.student_classroom_course_memory
  WHERE classroom_id = p_classroom_id;

  DELETE FROM public.student_section_unit_memory
  WHERE classroom_id = p_classroom_id;

  DELETE FROM public.video_watch_progress
  WHERE classroom_id = p_classroom_id;

  DELETE FROM public.five_d_snapshots
  WHERE classroom_id = p_classroom_id;

  DELETE FROM public.pilot_report_snapshots
  WHERE classroom_id = p_classroom_id;

  DELETE FROM public.section_comments sc
  USING public.syllabus_sections ss,
        public.syllabi s
  WHERE sc.section_id = ss.id
    AND ss.syllabus_id = s.id
    AND s.classroom_id = p_classroom_id
    AND sc.user_id IN (
      SELECT e.student_id
      FROM public.enrollments e
      WHERE e.classroom_id = p_classroom_id
    );
  GET DIAGNOSTICS v_section_comments_deleted = ROW_COUNT;

  UPDATE public.assignments
  SET assigned_student_id = NULL
  WHERE classroom_id = p_classroom_id
    AND assigned_student_id IS NOT NULL;
  GET DIAGNOSTICS v_assignments_cleared = ROW_COUNT;

  UPDATE public.enrollments
  SET active = false,
      deleted_at = now()
  WHERE classroom_id = p_classroom_id
    AND active = true;
  GET DIAGNOSTICS v_enrollments_updated = ROW_COUNT;

  v_after := public._classroom_reset_scope_counts(p_classroom_id);

  RETURN jsonb_build_object(
    'before', v_before,
    'deleted', jsonb_build_object(
      'submissions', v_submissions_deleted,
      'nuance_events', v_nuance_events_deleted,
      'module_flow_progress', v_module_progress_deleted,
      'section_progress', v_section_progress_deleted,
      'section_comments', v_section_comments_deleted,
      'enrollments_unenrolled', v_enrollments_updated,
      'assignments_student_target_cleared', v_assignments_cleared
    ),
    'after', v_after
  );
END;
$$;

COMMENT ON FUNCTION public.teacher_preview_classroom_reset(uuid) IS
  'Classroom teacher or app admin: read-only counts of student data that would be removed by teacher_reset_classroom.';

COMMENT ON FUNCTION public.teacher_reset_classroom(uuid) IS
  'Classroom teacher or app admin: atomically remove all students and their work from a classroom while preserving assignments, syllabus, and activities.';

REVOKE ALL ON FUNCTION public._assert_teacher_can_reset_classroom(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._classroom_reset_scope_counts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_preview_classroom_reset(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_reset_classroom(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.teacher_preview_classroom_reset(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_reset_classroom(uuid) TO authenticated;
