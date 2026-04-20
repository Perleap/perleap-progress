-- =============================================================================
-- Demo: sequential release, module structure, data-literacy topic
-- Classroom: /teacher/classroom/a1000000-0000-4000-8000-000000000102
-- Invite: SEQMOD (6 chars)
--
-- release_mode = sequential → next section unlocks when prior marked completed
--   (test as enrolled student; set progress in app or uncomment the optional
--    student block at the bottom of demo_seed.sql and adapt classroom id)
-- =============================================================================

DO $$
DECLARE
  v_teacher_id     uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_teacher_email  text := 'replace-with-teacher@example.com';


  v_classroom_id   uuid := 'a1000000-0000-4000-8000-000000000102'::uuid;
  v_a1 uuid := 'b2000000-0000-4000-8000-000000000211'::uuid;
  v_a2 uuid := 'b2000000-0000-4000-8000-000000000212'::uuid;
  v_a3 uuid := 'b2000000-0000-4000-8000-000000000213'::uuid;

  v_target jsonb := '{"cognitive": true, "emotional": false, "social": true, "creative": false, "behavioral": false}'::jsonb;

  v_syllabus uuid := 'c3000000-0000-4000-8000-000000000302'::uuid;
  v_m1 uuid := 'd4000000-0000-4000-8000-000000000511'::uuid;
  v_m2 uuid := 'd4000000-0000-4000-8000-000000000512'::uuid;
  v_m3 uuid := 'd4000000-0000-4000-8000-000000000513'::uuid;
  v_m4 uuid := 'd4000000-0000-4000-8000-000000000514'::uuid;
  v_m5 uuid := 'd4000000-0000-4000-8000-000000000515'::uuid;

  v_gc1 uuid := 'e5000000-0000-4000-8000-000000000611'::uuid;
  v_gc2 uuid := 'e5000000-0000-4000-8000-000000000612'::uuid;
  v_gc3 uuid := 'e5000000-0000-4000-8000-000000000613'::uuid;

  v_res uuid := 'f6000000-0000-4000-8000-000000000631'::uuid;
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
    'Data Literacy Studio',
    'Mathematics / CS',
    'SEQMOD',
    'From Spreadsheet to Story',
    '10 weeks',
    '2026-01-15', '2026-04-01',
    'Modules build from descriptive stats → visualization → inference → communication.',
    'https://example.org/data-literacy',
    '["Choose an appropriate chart for a question","Explain uncertainty in plain language"]'::jsonb,
    '["P-hacking misconceptions","Overplotting in dashboards"]'::jsonb,
    '[{"name": "Representation", "components": ["Charts", "Scales", "Color"]},
      {"name": "Inference", "components": ["Sampling", "Confidence (conceptual)"]}]'::jsonb,
    '[{"type":"link","url":"https://example.org/tidy-data","name":"Tidy data (example)"}]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignments (id, classroom_id, title, type, instructions, due_at, status, target_dimensions, personalization_flag)
  VALUES
    (v_a1, v_classroom_id, 'Module 1 checkpoint: summary stats', 'questions',
     'Answer 6 short questions on mean/median/mode using the provided toy dataset description.', '2026-02-01 23:59:59+00', 'published', v_target, false),
    (v_a2, v_classroom_id, 'Module 3 mini-analysis', 'text_essay',
     '500 words: one chart choice, one limitation, one plain-language takeaway.', '2026-03-01 23:59:59+00', 'published', v_target, false),
    (v_a3, v_classroom_id, 'Capstone: dashboard critique', 'project',
     'Pick a public dashboard; critique clarity, ethics, and one alternative visualization.', '2026-03-25 23:59:59+00', 'published', v_target, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabi (
    id, classroom_id, title, summary, structure_type, policies, release_mode,
    accent_color, banner_url, section_label_override, custom_settings,
    status, published_at
  )
  VALUES (
    v_syllabus, v_classroom_id,
    'Data Literacy Studio — Syllabus',
    'Hands-on modules from spreadsheets to careful claims, with emphasis on communication.',
    'modules',
    '[
      {"id":"seq-p1","type":"grading","label":"Grading","content":"Checkpoints 30 %, Essay 35 %, Project 35 %.","order_index":0},
      {"id":"seq-p2","type":"participation","label":"Participation","content":"Short in-module polls count toward engagement (low stakes).","order_index":1},
      {"id":"seq-p3","type":"late_work","label":"Late work","content":"48-hour grace once per module; otherwise 5 %/day to floor 60 %.","order_index":2}
    ]'::jsonb,
    'sequential',
    '#2563eb', NULL, 'Module',
    '{"demoScenario": "sequential_modules"}'::jsonb,
    'published', now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabus_sections (
    id, syllabus_id, title, description, order_index, start_date, end_date,
    objectives, resources, notes, content, completion_status, prerequisites, is_locked
  )
  VALUES
    (v_m1, v_syllabus, 'Module 1 — Foundations', 'Types of variables; summary statistics.', 0, '2026-01-15', '2026-01-28',
     ARRAY['Compare mean vs median for skewed data', 'Read a simple frequency table'],
     NULL, NULL, '<p>Sequential course: complete this module to unlock the next.</p>', 'auto', '{}', false),
    (v_m2, v_syllabus, 'Module 2 — Visual grammar', 'Scales, color, small multiples.', 1, '2026-01-29', '2026-02-12',
     ARRAY['Identify a misleading axis', 'Choose chart type for a question'],
     NULL, NULL, '<p>Emphasis on honest defaults and labeling.</p>', 'auto', '{}', false),
    (v_m3, v_syllabus, 'Module 3 — From plot to claim', 'Association vs causation; confounders at intro level.', 2, '2026-02-13', '2026-02-27',
     ARRAY['State a claim and the evidence needed', 'Name one confounder'],
     NULL, NULL, '<p>Mini-analysis assignment aligns with this module.</p>', 'auto', '{}', false),
    (v_m4, v_syllabus, 'Module 4 — Uncertainty', 'Sampling intuition; what noise looks like.', 3, '2026-02-28', '2026-03-14',
     ARRAY['Explain variability without formulas', 'Interpret a simple interval in words'],
     NULL, NULL, '<p>Keep formulas optional; focus on language.</p>', 'auto', '{}', false),
    (v_m5, v_syllabus, 'Module 5 — Showcase', 'Critique and present.', 4, '2026-03-15', '2026-04-01',
     ARRAY['Deliver a structured critique', 'Respond to one peer question'],
     NULL, NULL, '<p>Capstone presentations.</p>', 'auto', '{}', false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.activity_list (id, section_id, title, resource_type, url, order_index)
  VALUES (v_res, v_m2, 'Chart chooser cheatsheet (example)', 'link', 'https://example.org/chart-chooser', 0)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.grading_categories (id, syllabus_id, name, weight)
  VALUES
    (v_gc1, v_syllabus, 'Checkpoints', 30),
    (v_gc2, v_syllabus, 'Essay', 35),
    (v_gc3, v_syllabus, 'Project', 35)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.assignments SET syllabus_section_id = v_m1, grading_category_id = v_gc1 WHERE id = v_a1;
  UPDATE public.assignments SET syllabus_section_id = v_m3, grading_category_id = v_gc2 WHERE id = v_a2;
  UPDATE public.assignments SET syllabus_section_id = v_m5, grading_category_id = v_gc3 WHERE id = v_a3;

  RAISE NOTICE 'Sequential modules seed OK: classroom %', v_classroom_id;
END $$;
