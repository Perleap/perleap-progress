-- Replacing module_flow_steps (delete + insert) CASCADE-deleted student_module_flow_progress,
-- invalidating progress keyed by module_flow_step id and breaking sequential Curriculum UI.
-- This RPC backs up progress by (step_kind, assignment_id, activity_list_id), replaces steps,
-- then re-attaches progress to the new step rows.

CREATE OR REPLACE FUNCTION public.replace_module_flow_steps(
  p_section_id uuid,
  p_steps jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.syllabus_sections ss
    JOIN public.syllabi s ON s.id = ss.syllabus_id
    WHERE ss.id = p_section_id
      AND public.is_classroom_teacher(s.classroom_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  CREATE TEMP TABLE _mfp_backup ON COMMIT DROP AS
  SELECT
    smfp.student_id,
    smfp.status,
    smfp.completed_at,
    mfs.step_kind,
    mfs.assignment_id,
    mfs.activity_list_id
  FROM public.student_module_flow_progress smfp
  INNER JOIN public.module_flow_steps mfs ON mfs.id = smfp.module_flow_step_id
  WHERE mfs.section_id = p_section_id;

  DELETE FROM public.module_flow_steps WHERE section_id = p_section_id;

  IF p_steps IS NOT NULL AND jsonb_typeof(p_steps) = 'array' AND jsonb_array_length(p_steps) > 0 THEN
    INSERT INTO public.module_flow_steps (section_id, order_index, step_kind, activity_list_id, assignment_id)
    SELECT
      p_section_id,
      (value->>'order_index')::integer,
      value->>'step_kind',
      CASE
        WHEN value->>'step_kind' = 'resource' AND value ? 'activity_list_id' AND (value->>'activity_list_id') IS NOT NULL
          AND btrim(value->>'activity_list_id') <> ''
        THEN (value->>'activity_list_id')::uuid
        ELSE NULL
      END,
      CASE
        WHEN value->>'step_kind' = 'assignment' AND value ? 'assignment_id' AND (value->>'assignment_id') IS NOT NULL
          AND btrim(value->>'assignment_id') <> ''
        THEN (value->>'assignment_id')::uuid
        ELSE NULL
      END
    FROM jsonb_array_elements(p_steps) AS t(value);
  END IF;

  INSERT INTO public.student_module_flow_progress (student_id, module_flow_step_id, status, completed_at)
  SELECT b.student_id, mfs.id, b.status, b.completed_at
  FROM _mfp_backup b
  INNER JOIN public.module_flow_steps mfs
    ON mfs.section_id = p_section_id
   AND mfs.step_kind = b.step_kind
   AND (
     (b.step_kind = 'assignment' AND b.assignment_id IS NOT NULL AND mfs.assignment_id IS NOT DISTINCT FROM b.assignment_id)
     OR
     (b.step_kind = 'resource' AND b.activity_list_id IS NOT NULL AND mfs.activity_list_id IS NOT DISTINCT FROM b.activity_list_id)
   )
  ON CONFLICT (student_id, module_flow_step_id) DO UPDATE SET
    status = EXCLUDED.status,
    completed_at = EXCLUDED.completed_at,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.replace_module_flow_steps(uuid, jsonb) IS
  'Teacher-only: replace module_flow_steps for a section and remap student_module_flow_progress to new step ids.';

GRANT EXECUTE ON FUNCTION public.replace_module_flow_steps(uuid, jsonb) TO authenticated;
