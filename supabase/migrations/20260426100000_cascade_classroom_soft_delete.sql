-- ============================================================================
-- When a classroom transitions to soft-deleted (active: false + deleted_at set),
-- cascade the same deleted_at to all related rows that already use the
-- active/deleted_at pairing (see 20260422130000_activity_list_soft_delete.sql).
-- Runs in the same transaction as the classroom UPDATE (AFTER UPDATE trigger).
--
-- Out of scope / follow-ups (no active+deleted_at on these today):
--   - grading_categories, module_flow_steps, assignment_module_activities,
--     student_section_progress, etc.: add columns + policies if every row must
--     carry deleted_at; RLS on parents usually hides them once this cascade runs.
--   - submissions, chat, nuance: product decision for historical student data.
-- Teacher read access to inactive owned classrooms for "trash" UI may need
-- relaxed SELECT policies (is_classroom_teacher currently requires active classroom).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cascade_soft_delete_classroom_children()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.active IS TRUE
     AND NEW.active IS FALSE
     AND NEW.deleted_at IS NOT NULL THEN

    UPDATE public.enrollments
    SET active = false, deleted_at = NEW.deleted_at
    WHERE classroom_id = NEW.id AND active = true;

    UPDATE public.assignments
    SET active = false, deleted_at = NEW.deleted_at
    WHERE classroom_id = NEW.id AND active = true;

    UPDATE public.syllabi
    SET active = false, deleted_at = NEW.deleted_at
    WHERE classroom_id = NEW.id AND active = true;

    UPDATE public.syllabus_sections ss
    SET active = false, deleted_at = NEW.deleted_at
    FROM public.syllabi s
    WHERE ss.syllabus_id = s.id
      AND s.classroom_id = NEW.id
      AND ss.active = true;

    UPDATE public.activity_list al
    SET active = false, deleted_at = NEW.deleted_at
    FROM public.syllabus_sections ss
    JOIN public.syllabi s ON s.id = ss.syllabus_id
    WHERE al.section_id = ss.id
      AND s.classroom_id = NEW.id
      AND al.active = true;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_classroom_soft_delete ON public.classrooms;

CREATE TRIGGER trg_cascade_classroom_soft_delete
  AFTER UPDATE ON public.classrooms
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_soft_delete_classroom_children();

COMMENT ON FUNCTION public.cascade_soft_delete_classroom_children() IS
  'After a classroom is soft-deleted, sets active=false and the same deleted_at on enrollments, assignments, syllabi, syllabus_sections, and activity_list for that classroom.';
