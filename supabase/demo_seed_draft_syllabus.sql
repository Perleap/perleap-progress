-- =============================================================================
-- Demo: draft syllabus (teacher editor / not visible to students as published)
-- Classroom: /teacher/classroom/a1000000-0000-4000-8000-000000000106
-- Invite: DRFT01 (6 chars)
--
-- status = draft, published_at NULL. Sections + grading exist for editing flows.
-- One assignment is published (optional: see if product lists assignments without syllabus).
-- =============================================================================

DO $$
DECLARE
  v_teacher_id     uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_teacher_email  text := 'replace-with-teacher@example.com';


  v_classroom_id uuid := 'a1000000-0000-4000-8000-000000000106'::uuid;
  v_a1 uuid := 'b2000000-0000-4000-8000-000000000251'::uuid;
  v_a2 uuid := 'b2000000-0000-4000-8000-000000000252'::uuid;

  v_target jsonb := '{"cognitive": true, "emotional": false, "social": false, "creative": false, "behavioral": false}'::jsonb;

  v_syllabus uuid := 'c3000000-0000-4000-8000-000000000306'::uuid;
  v_t1 uuid := 'd4000000-0000-4000-8000-000000000551'::uuid;
  v_t2 uuid := 'd4000000-0000-4000-8000-000000000552'::uuid;

  v_gc1 uuid := 'e5000000-0000-4000-8000-000000000651'::uuid;
  v_gc2 uuid := 'e5000000-0000-4000-8000-000000000652'::uuid;
BEGIN
  IF v_teacher_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Set v_teacher_id and v_teacher_email.';
  END IF;

  INSERT INTO public.teacher_profiles (user_id, email, full_name)
  VALUES (v_teacher_id, v_teacher_email, 'Demo Teacher (seed)')
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(public.teacher_profiles.full_name, EXCLUDED.full_name);

  INSERT INTO public.classrooms (
    id, teacher_id, name, subject, invite_code,
    course_title, course_duration, start_date, end_date, course_outline, resources,
    learning_outcomes, key_challenges, domains, materials
  )
  VALUES (
    v_classroom_id, v_teacher_id,
    'Intro Robotics (WIP)',
    'STEM',
    'DRFT01',
    'Intro Robotics — draft syllabus',
    'TBD',
    NULL, NULL,
    'Outline still moving; syllabus not published yet.',
    NULL,
    '[]'::jsonb, '[]'::jsonb,
    '[{"name": "Mechanisms", "components": ["Gears", "Motors"]}]'::jsonb,
    '[]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignments (id, classroom_id, title, type, instructions, due_at, status, target_dimensions, personalization_flag)
  VALUES
    (v_a1, v_classroom_id, 'Draft: safety checklist', 'text_essay', 'List 8 lab rules in your own words (draft assignment).', NULL, 'draft', v_target, false),
    (v_a2, v_classroom_id, 'Published: parts ID quiz', 'quiz_mcq', 'Identify motor terminals A/B from diagram (placeholder).', '2026-04-01 23:59:59+00', 'published', v_target, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabi (
    id, classroom_id, title, summary, structure_type, policies, release_mode,
    accent_color, banner_url, section_label_override, custom_settings,
    status, published_at
  )
  VALUES (
    v_syllabus, v_classroom_id,
    'Intro Robotics — Syllabus (DRAFT)',
    'Work-in-progress: publish when ready.',
    'weeks',
    '[
      {"id":"dr-p1","type":"grading","label":"Grading (TBD)","content":"Weights will be finalized before publish.","order_index":0},
      {"id":"dr-p2","type":"custom","label":"Lab safety (draft)","content":"Closed-toed shoes; goggles when soldering (policy draft).","order_index":1}
    ]'::jsonb,
    'all_at_once',
    '#ea580c', NULL, 'Week',
    '{"demoScenario": "draft_syllabus"}'::jsonb,
    'draft',
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabus_sections (
    id, syllabus_id, title, description, order_index, start_date, end_date,
    objectives, resources, notes, content, completion_status, prerequisites, is_locked
  )
  VALUES
    (v_t1, v_syllabus, 'Week 1 — Mechanics primer', 'Draft content for teacher preview only.', 0, NULL, NULL,
     ARRAY['Name three simple machines', 'Assemble a gear train'],
     NULL, 'Dates TBD',
     '<p>This syllabus is <em>draft</em>; students should not rely on dates yet.</p>',
     'auto', '{}', false),
    (v_t2, v_syllabus, 'Week 2 — Motors & control', 'Placeholder week.', 1, NULL, NULL,
     ARRAY['Explain brushed vs brushless at high level'],
     NULL, NULL,
     '<p>Content to be expanded before publish.</p>',
     'auto', '{}', false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.grading_categories (id, syllabus_id, name, weight)
  VALUES
    (v_gc1, v_syllabus, 'Labs (TBD)', 60),
    (v_gc2, v_syllabus, 'Quizzes (TBD)', 40)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.assignments SET syllabus_section_id = v_t2, grading_category_id = v_gc2 WHERE id = v_a2;

  RAISE NOTICE 'Draft syllabus seed OK: classroom % (syllabus draft)', v_classroom_id;
END $$;
