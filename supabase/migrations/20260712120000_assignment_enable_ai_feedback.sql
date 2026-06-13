-- Split AI feedback: generation (enable_ai_feedback) vs student visibility (auto_publish_ai_feedback)

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS enable_ai_feedback boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.assignments.enable_ai_feedback IS
  'When true, AI feedback is generated automatically when a student submits.';

-- Preserve existing behavior: old "No" meant no auto-generation
UPDATE public.assignments
SET enable_ai_feedback = auto_publish_ai_feedback
WHERE enable_ai_feedback IS DISTINCT FROM auto_publish_ai_feedback;

COMMENT ON COLUMN public.assignments.auto_publish_ai_feedback IS
  'When true, students see AI feedback as soon as it is generated. When false, teacher must release feedback.';

-- Patch merge_course_package_v2 to merge enable_ai_feedback from course packages
CREATE OR REPLACE FUNCTION public.merge_course_package_v2(
  p_classroom_id uuid,
  p_pkg jsonb,
  p_update_classroom boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  course jsonb := p_pkg -> 'course';
  syllabus jsonb := course -> 'syllabus';
  v_live_syllabus uuid;
  uid uuid := auth.uid();
  nsec int := 0;
  i int := 0;
  j int := 0;
  k int := 0;
  sec jsonb;
  act jsonb;
  gc jsonb;
  n int := 0;
  a jsonb;
  aid uuid;
  sec_ref text;
  gc_ref text;
  lk jsonb;
  mf jsonb;
  steps_payload jsonb;
BEGIN
  IF uid IS NULL THEN
    PERFORM public.merge_raise(jsonb_build_object('phase','classroom_patch','humanLabel','not authenticated'));
  END IF;

  IF NOT public.is_classroom_teacher(p_classroom_id, uid) THEN
    PERFORM public.merge_raise(jsonb_build_object('phase','classroom_patch','humanLabel','not authorized'));
  END IF;

  IF trim(both FROM coalesce(p_pkg ->> 'exported_from_classroom_id','')) <> p_classroom_id::text THEN
    PERFORM public.merge_raise(jsonb_build_object('phase','exported_from_guard'));
  END IF;

  IF course IS NULL THEN
    PERFORM public.merge_raise(jsonb_build_object('phase','exported_from_guard','humanLabel','missing course'));
  END IF;

  IF syllabus IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(syllabus -> 'sections','[]'::jsonb)) elt(elt),
           LATERAL jsonb_array_elements(coalesce(elt -> 'activities','[]'::jsonb)) arc(arc)
      WHERE elt ->> 'id' IS NULL OR btrim(elt ->> 'id') = ''
         OR arc ->> 'id' IS NULL OR btrim(arc ->> 'id') = ''
    ) THEN
      PERFORM public.merge_raise(jsonb_build_object(
        'phase','sections','humanLabel','RPC requires UUID ids on all syllabus sections and activities'));
    END IF;
  END IF;

  IF coalesce(p_update_classroom,FALSE) THEN
    UPDATE public.classrooms c SET
      name = trim(both FROM coalesce(course -> 'classroom' ->> 'name', c.name)),
      subject = coalesce(course -> 'classroom' ->> 'subject', c.subject),
      goals = course -> 'classroom' ->> 'goals',
      course_title = course -> 'classroom' ->> 'course_title',
      course_duration = course -> 'classroom' ->> 'course_duration',
      start_date = nullif(course -> 'classroom' ->> 'start_date','')::timestamptz,
      end_date = nullif(course -> 'classroom' ->> 'end_date','')::timestamptz,
      course_outline = course -> 'classroom' ->> 'course_outline',
      resources = course -> 'classroom' ->> 'resources',
      learning_outcomes = course -> 'classroom' -> 'learning_outcomes',
      key_challenges = course -> 'classroom' -> 'key_challenges',
      domains = course -> 'classroom' -> 'domains',
      materials = course -> 'classroom' -> 'materials'
    WHERE c.id = p_classroom_id AND coalesce(c.active, TRUE);
  END IF;

  IF syllabus IS NOT NULL THEN
    SELECT y.id INTO v_live_syllabus
    FROM public.syllabi y
    WHERE y.classroom_id = p_classroom_id AND coalesce(y.active, TRUE)
    ORDER BY y.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_live_syllabus IS NULL THEN
      PERFORM public.merge_raise(jsonb_build_object(
        'phase','syllabus_mismatch','humanLabel','This classroom has no syllabus to merge into.'));
    END IF;

    IF v_live_syllabus IS DISTINCT FROM (syllabus ->> 'id')::uuid THEN
      PERFORM public.merge_raise(jsonb_build_object(
        'phase','syllabus_mismatch','entityId', syllabus ->> 'id','humanLabel', syllabus ->> 'title'));
    END IF;

    UPDATE public.syllabi y SET
      title = syllabus ->> 'title',
      summary = syllabus ->> 'summary',
      structure_type = coalesce(nullif(btrim(syllabus ->> 'structure_type'),''), y.structure_type),
      policies = coalesce(syllabus -> 'policies', y.policies),
      status = coalesce(nullif(btrim(syllabus ->> 'status'),''), y.status),
      release_mode = coalesce(nullif(btrim(syllabus ->> 'release_mode'),''), y.release_mode),
      published_at = CASE
          WHEN syllabus ? 'published_at'
           AND nullif(trim(syllabus ->> 'published_at'),'') IS NOT NULL
          THEN (syllabus ->> 'published_at')::timestamptz
          ELSE y.published_at END,
      accent_color = syllabus ->> 'accent_color',
      banner_url = syllabus ->> 'banner_url',
      section_label_override = syllabus ->> 'section_label_override',
      custom_settings = coalesce(syllabus -> 'custom_settings','{}'::jsonb)
    WHERE y.id = v_live_syllabus;

    n := coalesce(jsonb_array_length(coalesce(syllabus -> 'grading_categories','[]'::jsonb)),0);
    FOR i IN 0 .. n - 1 LOOP
      gc := syllabus -> 'grading_categories' -> i;
      IF EXISTS (
        SELECT 1 FROM public.grading_categories gg
        WHERE gg.id = (gc ->> 'id')::uuid AND gg.syllabus_id = v_live_syllabus
      ) THEN
        UPDATE public.grading_categories gg SET
          name = gc ->> 'name',
          weight = (gc ->> 'weight')::numeric
        WHERE gg.id = (gc ->> 'id')::uuid AND gg.syllabus_id = v_live_syllabus;
      ELSIF EXISTS (SELECT 1 FROM public.grading_categories gg WHERE gg.id = (gc ->> 'id')::uuid AND gg.syllabus_id <> v_live_syllabus) THEN
        PERFORM public.merge_raise(jsonb_build_object(
          'phase','grading_categories','indexInPkg', i,'humanLabel', gc ->> 'name'));
      ELSE
        INSERT INTO public.grading_categories (id, syllabus_id, name, weight)
        VALUES ((gc ->> 'id')::uuid, v_live_syllabus, gc ->> 'name', (gc ->> 'weight')::numeric);
      END IF;
    END LOOP;

    nsec := coalesce(jsonb_array_length(coalesce(syllabus -> 'sections','[]'::jsonb)),0);
    FOR i IN 0 .. nsec - 1 LOOP
      sec := syllabus -> 'sections' -> i;

      IF NOT EXISTS (
        SELECT 1 FROM public.syllabus_sections ss0
        WHERE ss0.id = (sec ->> 'id')::uuid
          AND ss0.syllabus_id = v_live_syllabus
          AND coalesce(ss0.active, TRUE)
      ) THEN
        PERFORM public.merge_raise(jsonb_build_object(
          'phase','sections','indexInPkg', i,'entity','section','entityId', sec ->> 'id','humanLabel', sec ->> 'title'));
      END IF;

      UPDATE public.syllabus_sections ss SET
        title = sec ->> 'title',
        description = sec ->> 'description',
        content = sec ->> 'content',
        order_index = (sec ->> 'order_index')::int,
        start_date = nullif(sec ->> 'start_date','')::timestamptz,
        end_date = nullif(sec ->> 'end_date','')::timestamptz,
        objectives = CASE
          WHEN jsonb_array_length(coalesce(sec -> 'objectives','[]'::jsonb)) = 0 THEN ss.objectives
          ELSE ARRAY(SELECT jsonb_array_elements_text(sec -> 'objectives')) END,
        resources = sec ->> 'resources',
        notes = sec ->> 'notes',
        completion_status = coalesce(nullif(trim(sec ->> 'completion_status'),''), ss.completion_status),
        is_locked = coalesce((sec ->> 'is_locked')::boolean, ss.is_locked)
      WHERE ss.id = (sec ->> 'id')::uuid
        AND ss.syllabus_id = v_live_syllabus
        AND coalesce(ss.active, TRUE);

      j := coalesce(jsonb_array_length(coalesce(sec -> 'activities','[]'::jsonb)),0);
      FOR k IN 0 .. j - 1 LOOP
        act := sec -> 'activities' -> k;
        IF NOT EXISTS (
          SELECT 1 FROM public.activity_list al0
          WHERE al0.id = (act ->> 'id')::uuid
            AND al0.section_id = (sec ->> 'id')::uuid
            AND coalesce(al0.active, TRUE)
        ) THEN
          PERFORM public.merge_raise(jsonb_build_object(
            'phase','activities','indexInPkg', k,'entity','activity','entityId', act ->> 'id','humanLabel', act ->> 'title'));
        END IF;
        UPDATE public.activity_list al SET
          title = act ->> 'title',
          resource_type = coalesce(act ->> 'resource_type', al.resource_type),
          order_index = (act ->> 'order_index')::int,
          status = coalesce(act ->> 'status', 'published'),
          lesson_content = act -> 'lesson_content'
        WHERE al.id = (act ->> 'id')::uuid
          AND al.section_id = (sec ->> 'id')::uuid
          AND coalesce(al.active, TRUE);
      END LOOP;
    END LOOP;

    FOR i IN 0 .. nsec - 1 LOOP
      sec := syllabus -> 'sections' -> i;
      UPDATE public.syllabus_sections ss
      SET prerequisites = coalesce(
        ARRAY(
          SELECT (jsonb_array_elements_text(coalesce(sec -> 'prerequisites_section_ids','[]'::jsonb)))::uuid
        ),
        ARRAY[]::uuid[]
      )
      WHERE ss.id = (sec ->> 'id')::uuid
        AND ss.syllabus_id = v_live_syllabus;
    END LOOP;
  END IF;

  n := coalesce(jsonb_array_length(coalesce(course -> 'assignments','[]'::jsonb)),0);
  FOR i IN 0 .. n - 1 LOOP
    a := course -> 'assignments' -> i;
    aid := (a ->> 'id')::uuid;

    IF NOT EXISTS (
      SELECT 1 FROM public.assignments asg
      WHERE asg.id = aid AND asg.classroom_id = p_classroom_id AND coalesce(asg.active, TRUE)
    ) THEN
      PERFORM public.merge_raise(jsonb_build_object(
        'phase','assignments','indexInPkg', i,'humanLabel', a ->> 'title'));
    END IF;

    UPDATE public.assignments aa SET
      title = coalesce(a ->> 'title', aa.title),
      instructions = coalesce(a ->> 'instructions', aa.instructions),
      student_facing_task = CASE WHEN jsonb_path_exists(a, '$.student_facing_task')
          THEN NULLIF(trim(a ->> 'student_facing_task'),'')
          ELSE aa.student_facing_task END,
      type = coalesce(NULLIF(trim(a ->> 'type'),'')::public.assignment_type, aa.type),
      status = coalesce(NULLIF(trim(a ->> 'status'),'')::public.assignment_status, aa.status),
      due_at = CASE WHEN jsonb_path_exists(a, '$.due_at')
        AND NULLIF(trim(a ->> 'due_at'),'') IS NOT NULL
        THEN (a ->> 'due_at')::timestamptz
        ELSE aa.due_at END,
      target_dimensions = coalesce(a -> 'target_dimensions', aa.target_dimensions),
      personalization_flag = coalesce((a ->> 'personalization_flag')::boolean, aa.personalization_flag),
      enable_ai_feedback = coalesce((a ->> 'enable_ai_feedback')::boolean, aa.enable_ai_feedback),
      auto_publish_ai_feedback = coalesce((a ->> 'auto_publish_ai_feedback')::boolean, aa.auto_publish_ai_feedback),
      attempt_mode = coalesce(
        CASE WHEN NULLIF(trim(a ->> 'attempt_mode'),'') IS NOT NULL
          THEN (a ->> 'attempt_mode')::public.assignment_attempt_mode END,
        aa.attempt_mode),
      materials = CASE WHEN jsonb_path_exists(a, '$.materials') THEN (a -> 'materials')::jsonb ELSE aa.materials END,
      hard_skills = CASE WHEN jsonb_path_exists(a, '$.hard_skills') THEN NULLIF(trim(a ->> 'hard_skills'),'') ELSE aa.hard_skills END,
      hard_skill_domain = CASE WHEN jsonb_path_exists(a, '$.hard_skill_domain') THEN NULLIF(trim(a ->> 'hard_skill_domain'),'') ELSE aa.hard_skill_domain END
    WHERE aa.id = aid;

    sec_ref := nullif(trim(a ->> 'syllabus_section_ref'), '');
    gc_ref := nullif(trim(a ->> 'grading_category_ref'), '');

    IF sec_ref IS NOT NULL THEN
      IF v_live_syllabus IS NULL THEN
        PERFORM public.merge_raise(jsonb_build_object('phase','assignments','indexInPkg', i,'humanLabel', a ->> 'title'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.syllabus_sections ss
        WHERE ss.id = sec_ref::uuid AND ss.syllabus_id = v_live_syllabus AND coalesce(ss.active, TRUE)
      ) THEN
        PERFORM public.merge_raise(jsonb_build_object('phase','assignments','indexInPkg', i,'humanLabel', a ->> 'title'));
      END IF;
      UPDATE public.assignments aa SET
        syllabus_section_id = sec_ref::uuid,
        grading_category_id = CASE WHEN gc_ref IS NOT NULL THEN gc_ref::uuid ELSE NULL END
      WHERE aa.id = aid;
    ELSE
      UPDATE public.assignments aa SET
        syllabus_section_id = NULL,
        grading_category_id = NULL
      WHERE aa.id = aid;
      IF gc_ref IS NOT NULL AND v_live_syllabus IS NOT NULL THEN
        IF EXISTS (
          SELECT 1 FROM public.grading_categories gg WHERE gg.id = gc_ref::uuid AND gg.syllabus_id = v_live_syllabus
        ) THEN
          UPDATE public.assignments aa SET grading_category_id = gc_ref::uuid WHERE aa.id = aid;
        END IF;
      END IF;
      DELETE FROM public.assignment_module_activities ama WHERE ama.assignment_id = aid;
      CONTINUE;
    END IF;

    DELETE FROM public.assignment_module_activities ama WHERE ama.assignment_id = aid;
    IF sec_ref IS NOT NULL THEN
      j := coalesce(jsonb_array_length(coalesce(course -> 'assignment_activity_links' -> i,'[]'::jsonb)),0);
      FOR k IN 0 .. j - 1 LOOP
        lk := course -> 'assignment_activity_links' -> i -> k;
        CONTINUE WHEN lk IS NULL OR NOT (lk ? 'activity_ref');
        CONTINUE WHEN lk ->> 'activity_ref' IS NULL OR btrim(lk ->> 'activity_ref') = '';
        INSERT INTO public.assignment_module_activities (
          assignment_id, activity_list_id, order_index, include_in_ai_context
        ) VALUES (
          aid,
          (lk ->> 'activity_ref')::uuid,
          (lk ->> 'order_index')::int,
          coalesce((lk ->> 'include_in_ai_context')::boolean, true)
        );
      END LOOP;
    END IF;
  END LOOP;

  mf := course -> 'module_flow_by_section';
  IF syllabus IS NOT NULL AND mf IS NOT NULL AND jsonb_typeof(mf) = 'array' THEN
    IF jsonb_array_length(mf) <> nsec THEN
      PERFORM public.merge_raise(jsonb_build_object('phase','module_flow'));
    END IF;
    FOR i IN 0 .. nsec - 1 LOOP
      sec := syllabus -> 'sections' -> i;
      j := coalesce(jsonb_array_length(coalesce(mf -> i,'[]'::jsonb)),0);
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'order_index', s.k,
          'step_kind', mf #>> ARRAY[i::text, s.k::text, 'step_kind'],
          'activity_list_id',
            CASE
              WHEN (mf #>> ARRAY[i::text, s.k::text, 'step_kind']) = 'resource'
              THEN to_jsonb(nullif(trim(mf #>> ARRAY[i::text, s.k::text, 'activity_ref']),''))
              ELSE 'null'::jsonb END,
          'assignment_id',
            CASE
              WHEN (mf #>> ARRAY[i::text, s.k::text, 'step_kind']) = 'assignment'
              THEN to_jsonb(nullif(trim(mf #>> ARRAY[i::text, s.k::text, 'assignment_ref']),''))
              ELSE 'null'::jsonb END
        )
        ORDER BY s.k),
        '[]'::jsonb)
      INTO steps_payload
      FROM generate_series(0, GREATEST(j - 1, -1)) AS s(k)
      WHERE j > 0;

      IF j <= 0 THEN
        PERFORM public.replace_module_flow_steps((sec ->> 'id')::uuid, '[]'::jsonb);
      ELSE
        PERFORM public.replace_module_flow_steps((sec ->> 'id')::uuid, steps_payload);
      END IF;
    END LOOP;
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.merge_course_package_v2(uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_course_package_v2(uuid, jsonb, boolean) TO authenticated;
