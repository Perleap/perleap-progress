-- =============================================================================
-- Demo: manual release — teacher toggles is_locked per section
-- Classroom: /teacher/classroom/a1000000-0000-4000-8000-000000000105
-- Invite: MAN001 (6 chars)
--
-- release_mode = manual → unlocked when is_locked is false (sectionUnlock.ts).
-- Seed keeps Unit 1 open; Units 2–3 locked until you clear is_locked in SQL or UI.
-- =============================================================================

DO $$
DECLARE
  v_teacher_id     uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_teacher_email  text := 'replace-with-teacher@example.com';


  v_classroom_id uuid := 'a1000000-0000-4000-8000-000000000105'::uuid;
  v_a1 uuid := 'b2000000-0000-4000-8000-000000000241'::uuid;

  v_target jsonb := '{"cognitive": false, "emotional": false, "social": true, "creative": true, "behavioral": false}'::jsonb;

  v_syllabus uuid := 'c3000000-0000-4000-8000-000000000305'::uuid;
  v_x1 uuid := 'd4000000-0000-4000-8000-000000000541'::uuid;
  v_x2 uuid := 'd4000000-0000-4000-8000-000000000542'::uuid;
  v_x3 uuid := 'd4000000-0000-4000-8000-000000000543'::uuid;

  v_gc1 uuid := 'e5000000-0000-4000-8000-000000000641'::uuid;
  v_gc2 uuid := 'e5000000-0000-4000-8000-000000000642'::uuid;

  v_c1 uuid := 'f6000000-0000-4000-8000-000000000651'::uuid;
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
    'Storytelling Workshop',
    'Arts / Communication',
    'MAN001',
    '3-Session Storytelling Intensive',
    '3 sessions',
    '2026-03-01', '2026-03-15',
    'Session 1: premise. Session 2: scene work. Session 3: performance.',
    NULL,
    '["Deliver a 3-minute story with a clear turn","Give structured peer feedback"]'::jsonb,
    '["Performance anxiety","Pacing"]'::jsonb,
    '[{"name": "Craft", "components": ["Hook", "Stakes", "Turn"]}]'::jsonb,
    '[]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignments (id, classroom_id, title, type, instructions, due_at, status, target_dimensions, personalization_flag, materials)
  VALUES (
    v_a1, v_classroom_id,
    'Workshop reflection', 'text_essay',
    '400 words: one technique you will reuse; one risk you noticed in your delivery.',
    '2026-03-14 23:59:59+00', 'published', v_target, false,
    '[{"type":"link","url":"https://example.org/story-structure","name":"Story structure (example)"}]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabi (
    id, classroom_id, title, summary, structure_type, policies, release_mode,
    accent_color, banner_url, section_label_override, custom_settings,
    status, published_at
  )
  VALUES (
    v_syllabus, v_classroom_id,
    'Storytelling Workshop — Syllabus',
    'Manual gates: unlock sessions when the cohort is ready.',
    'modules',
    '[
      {"id":"mn-p1","type":"grading","label":"Grading","content":"Participation 40 %, Story performance 40 %, Reflection 20 %.","order_index":0},
      {"id":"mn-p2","type":"communication","label":"Safety","content":"Stories can be personal; pass option always available.","order_index":1}
    ]'::jsonb,
    'manual',
    '#db2777', NULL, 'Session',
    '{"demoScenario": "manual_workshop"}'::jsonb,
    'published', now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabus_sections (
    id, syllabus_id, title, description, order_index, start_date, end_date,
    objectives, resources, notes, content, completion_status, prerequisites, is_locked
  )
  VALUES
    (v_x1, v_syllabus, 'Session 1 — Premise & stakes', 'Open by default for manual mode.', 0, '2026-03-01', '2026-03-05',
     ARRAY['Draft a one-sentence premise', 'Name the stakes'],
     NULL, NULL, '<p><strong>Unlocked</strong> (<code>is_locked = false</code>).</p>',
     'completed', '{}', false),
    (v_x2, v_syllabus, 'Session 2 — Scene on its feet', 'Locked until teacher releases.', 1, '2026-03-06', '2026-03-10',
     ARRAY['Block a scene', 'Try two different endings'],
     NULL, NULL, '<p><strong>Locked</strong> for student view until you toggle lock off.</p>',
     'auto', '{}', true),
    (v_x3, v_syllabus, 'Session 3 — Showcase', 'Also locked in seed.', 2, '2026-03-11', '2026-03-15',
     ARRAY['Perform 3 minutes', 'Receive two pieces of feedback'],
     NULL, NULL, '<p>Showcase + peer feedback.</p>',
     'skipped', '{}', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.section_comments (id, section_id, user_id, content, parent_id)
  VALUES (v_c1, v_x1, v_teacher_id, 'Seed note: Session 1 marked completed for teacher roadmap; adjust completion_status as you like.', NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.grading_categories (id, syllabus_id, name, weight)
  VALUES
    (v_gc1, v_syllabus, 'Performance + participation', 80),
    (v_gc2, v_syllabus, 'Reflection', 20)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.assignments SET syllabus_section_id = v_x3, grading_category_id = v_gc2 WHERE id = v_a1;

  RAISE NOTICE 'Manual workshop seed OK: classroom %', v_classroom_id;
END $$;
