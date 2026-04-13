-- =============================================================================
-- Demo: prerequisites release_mode + explicit prerequisite UUID arrays
-- Classroom: /teacher/classroom/a1000000-0000-4000-8000-000000000104
-- Invite: PREREQ (6 chars)
--
-- release_mode = prerequisites matches src/lib/sectionUnlock.ts:
--   section unlocks when every listed prerequisite section is "completed"
--   in student_section_progress (enrolled student).
-- =============================================================================

DO $$
DECLARE
  v_teacher_id     uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_teacher_email  text := 'replace-with-teacher@example.com';


  v_classroom_id uuid := 'a1000000-0000-4000-8000-000000000104'::uuid;
  v_a1 uuid := 'b2000000-0000-4000-8000-000000000231'::uuid;
  v_a2 uuid := 'b2000000-0000-4000-8000-000000000232'::uuid;
  v_a3 uuid := 'b2000000-0000-4000-8000-000000000233'::uuid;

  v_target jsonb := '{"cognitive": true, "emotional": true, "social": true, "creative": true, "behavioral": false}'::jsonb;

  v_syllabus uuid := 'c3000000-0000-4000-8000-000000000304'::uuid;
  v_s1 uuid := 'd4000000-0000-4000-8000-000000000531'::uuid;
  v_s2 uuid := 'd4000000-0000-4000-8000-000000000532'::uuid;
  v_s3 uuid := 'd4000000-0000-4000-8000-000000000533'::uuid;
  v_s4 uuid := 'd4000000-0000-4000-8000-000000000534'::uuid;

  v_gc1 uuid := 'e5000000-0000-4000-8000-000000000631'::uuid;
  v_gc2 uuid := 'e5000000-0000-4000-8000-000000000632'::uuid;
  v_gc3 uuid := 'e5000000-0000-4000-8000-000000000633'::uuid;
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
    'Design Methods',
    'Design / Engineering',
    'PREREQ',
    'Human-Centered Design Methods',
    '4 weeks',
    '2026-02-01', '2026-02-28',
    'Discover → define → prototype → test; each phase depends on the prior.',
    NULL,
    '["Write a POV statement","Run a usability test with 3 participants"]'::jsonb,
    '["Scope creep","Prototype fidelity"]'::jsonb,
    '[{"name": "Research", "components": ["Interviews", "Journey maps"]},
      {"name": "Delivery", "components": ["Prototypes", "Test plans"]}]'::jsonb,
    '[]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignments (id, classroom_id, title, type, instructions, due_at, status, target_dimensions, personalization_flag)
  VALUES
    (v_a1, v_classroom_id, 'Interview synthesis', 'text_essay', '600 words: themes + two surprising quotes + one POV.', '2026-02-08 23:59:59+00', 'published', v_target, false),
    (v_a2, v_classroom_id, 'Paper prototype test', 'project', 'Photos + 3 usability findings + severity tags.', '2026-02-18 23:59:59+00', 'published', v_target, false),
    (v_a3, v_classroom_id, 'Retro: lessons learned', 'presentation', '5 slides max; what you would redo.', '2026-02-26 23:59:59+00', 'published', v_target, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabi (
    id, classroom_id, title, summary, structure_type, policies, release_mode,
    accent_color, banner_url, section_label_override, custom_settings,
    status, published_at
  )
  VALUES (
    v_syllabus, v_classroom_id,
    'Design Methods — Syllabus',
    'Prerequisite DAG: later phases require completing earlier roadmap nodes.',
    'weeks',
    '[
      {"id":"pr-p1","type":"grading","label":"Grading","content":"Synthesis 30 %, Prototype test 40 %, Retro 30 %.","order_index":0},
      {"id":"pr-p2","type":"custom","label":"Studio norms","content":"Critique the idea, not the person; phones away during tests.","order_index":1}
    ]'::jsonb,
    'prerequisites',
    '#7c3aed', NULL, 'Phase',
    '{"demoScenario": "prerequisites_dag"}'::jsonb,
    'published', now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabus_sections (
    id, syllabus_id, title, description, order_index, start_date, end_date,
    objectives, resources, notes, content, completion_status, prerequisites, is_locked
  )
  VALUES
    (v_s1, v_syllabus, 'Phase 1 — Discover', 'Interviews and journey map.', 0, '2026-02-01', '2026-02-07',
     ARRAY['Conduct two interviews', 'Draft a journey map v0'],
     NULL, NULL,
     '<p>No prerequisites. Entry node.</p>', 'auto', '{}', false),
    (v_s2, v_syllabus, 'Phase 2 — Define', 'POV, HMW, scope.', 1, '2026-02-08', '2026-02-14',
     ARRAY['Write a POV statement', 'List top 3 assumptions'],
     NULL, NULL,
     '<p>Requires Phase 1 completed in student progress.</p>', 'auto', ARRAY[v_s1]::uuid[], false),
    (v_s3, v_syllabus, 'Phase 3 — Prototype', 'Low-fi prototypes.', 2, '2026-02-15', '2026-02-21',
     ARRAY['Build paper prototype', 'Prepare test script'],
     NULL, NULL,
     '<p>Requires Phase 2.</p>', 'auto', ARRAY[v_s2]::uuid[], false),
    (v_s4, v_syllabus, 'Phase 4 — Test & retro', 'Usability test + team retro.', 3, '2026-02-22', '2026-02-28',
     ARRAY['Run usability sessions', 'Summarize findings'],
     NULL, NULL,
     '<p>Requires Phase 3 (single parent) for a simple chain; add more UUIDs for join gates.</p>',
     'auto', ARRAY[v_s3]::uuid[], false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.grading_categories (id, syllabus_id, name, weight)
  VALUES
    (v_gc1, v_syllabus, 'Synthesis', 30),
    (v_gc2, v_syllabus, 'Prototype test', 40),
    (v_gc3, v_syllabus, 'Retro', 30)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.assignments SET syllabus_section_id = v_s2, grading_category_id = v_gc1 WHERE id = v_a1;
  UPDATE public.assignments SET syllabus_section_id = v_s3, grading_category_id = v_gc2 WHERE id = v_a2;
  UPDATE public.assignments SET syllabus_section_id = v_s4, grading_category_id = v_gc3 WHERE id = v_a3;

  RAISE NOTICE 'Prerequisites seed OK: classroom %', v_classroom_id;
END $$;
