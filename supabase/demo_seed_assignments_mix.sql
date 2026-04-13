-- =============================================================================
-- Demo: many assignment types + materials JSON + syllabus (all_at_once)
-- Classroom: /teacher/classroom/a1000000-0000-4000-8000-000000000107
-- Invite: ASGMIX (6 chars)
--
-- Exercises assignment list UI, materials attachments, and mixed published/draft.
-- =============================================================================

DO $$
DECLARE
  v_teacher_id     uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_teacher_email  text := 'replace-with-teacher@example.com';


  v_classroom_id uuid := 'a1000000-0000-4000-8000-000000000107'::uuid;

  v_target jsonb := '{"cognitive": true, "emotional": true, "social": true, "creative": true, "behavioral": true}'::jsonb;
  v_mat jsonb := '[{"type":"link","url":"https://example.org/rubric","name":"Rubric (example)"}]'::jsonb;

  v_a1 uuid := 'b2000000-0000-4000-8000-000000000261'::uuid;
  v_a2 uuid := 'b2000000-0000-4000-8000-000000000262'::uuid;
  v_a3 uuid := 'b2000000-0000-4000-8000-000000000263'::uuid;
  v_a4 uuid := 'b2000000-0000-4000-8000-000000000264'::uuid;
  v_a5 uuid := 'b2000000-0000-4000-8000-000000000265'::uuid;
  v_a6 uuid := 'b2000000-0000-4000-8000-000000000266'::uuid;
  v_a7 uuid := 'b2000000-0000-4000-8000-000000000267'::uuid;

  v_syllabus uuid := 'c3000000-0000-4000-8000-000000000307'::uuid;
  v_z1 uuid := 'd4000000-0000-4000-8000-000000000561'::uuid;
  v_z2 uuid := 'd4000000-0000-4000-8000-000000000562'::uuid;

  v_gc1 uuid := 'e5000000-0000-4000-8000-000000000661'::uuid;
  v_gc2 uuid := 'e5000000-0000-4000-8000-000000000662'::uuid;
  v_gc3 uuid := 'e5000000-0000-4000-8000-000000000663'::uuid;
  v_gc4 uuid := 'e5000000-0000-4000-8000-000000000664'::uuid;
  v_gc5 uuid := 'e5000000-0000-4000-8000-000000000665'::uuid;
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
    'Assignment Types Sandbox',
    'General',
    'ASGMIX',
    'Mixed assignment types',
    '4 weeks',
    '2026-04-01', '2026-04-30',
    'Not a real course — for QA of assignment cards and filters.',
    NULL,
    '[]'::jsonb, '[]'::jsonb,
    '[]'::jsonb, '[]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignments (
    id, classroom_id, title, type, instructions, due_at, status, target_dimensions, personalization_flag, materials
  )
  VALUES
    (v_a1, v_classroom_id, 'Essay: position statement', 'text_essay',
     '300–500 words; claim + two reasons + one counterargument.', '2026-04-05 23:59:59+00', 'published', v_target, false, v_mat),
    (v_a2, v_classroom_id, 'Short-answer set', 'questions',
     'Five short answers on the reading (seed placeholder).', '2026-04-06 23:59:59+00', 'published', v_target, false, NULL),
    (v_a3, v_classroom_id, 'Unit check (MCQ)', 'test',
     '12 questions; open book.', '2026-04-08 23:59:59+00', 'published', v_target, false, NULL),
    (v_a4, v_classroom_id, 'Build: cardboard prototype', 'project',
     'Photo + 200 words on what failed and what you would change.', '2026-04-12 23:59:59+00', 'published', v_target, false, v_mat),
    (v_a5, v_classroom_id, 'Lightning talk', 'presentation',
     '3 minutes; one slide allowed.', '2026-04-15 23:59:59+00', 'published', v_target, false, NULL),
    (v_a6, v_classroom_id, 'Legacy: creative task', 'creative_task',
     'Optional seed for legacy enum value.', '2026-04-18 23:59:59+00', 'published', v_target, false, NULL),
    (v_a7, v_classroom_id, 'WIP: discussion (draft)', 'discussion_prompt',
     'Draft — not visible to students while status is draft.', NULL, 'draft', v_target, false, NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabi (
    id, classroom_id, title, summary, structure_type, policies, release_mode,
    accent_color, banner_url, section_label_override, custom_settings,
    status, published_at
  )
  VALUES (
    v_syllabus, v_classroom_id,
    'Sandbox — Syllabus',
    'Two roadmap buckets for linking different assignment styles.',
    'modules',
    '[
      {"id":"mx-p1","type":"grading","label":"Weights","content":"Even split across five published tasks (see categories).","order_index":0}
    ]'::jsonb,
    'all_at_once',
    '#64748b', NULL, 'Track',
    '{"demoScenario": "assignments_mix"}'::jsonb,
    'published', now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabus_sections (
    id, syllabus_id, title, description, order_index, start_date, end_date,
    objectives, resources, notes, content, completion_status, prerequisites, is_locked
  )
  VALUES
    (v_z1, v_syllabus, 'Track A — Write & show', 'Written work + presentations.', 0, '2026-04-01', '2026-04-15',
     ARRAY['Ship one polished written piece', 'Deliver one timed talk'],
     NULL, NULL, '<p>Links essay, questions, presentation rows.</p>', 'auto', '{}', false),
    (v_z2, v_syllabus, 'Track B — Make & verify', 'Build + tests.', 1, '2026-04-08', '2026-04-30',
     ARRAY['Iterate a physical prototype', 'Validate with a short test'],
     NULL, NULL, '<p>Links project + test + creative_task.</p>', 'auto', '{}', false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.grading_categories (id, syllabus_id, name, weight)
  VALUES
    (v_gc1, v_syllabus, 'Writing', 20),
    (v_gc2, v_syllabus, 'Checks', 20),
    (v_gc3, v_syllabus, 'Build', 20),
    (v_gc4, v_syllabus, 'Talk', 20),
    (v_gc5, v_syllabus, 'Other / legacy', 20)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.assignments SET syllabus_section_id = v_z1, grading_category_id = v_gc1 WHERE id = v_a1;
  UPDATE public.assignments SET syllabus_section_id = v_z1, grading_category_id = v_gc2 WHERE id = v_a2;
  UPDATE public.assignments SET syllabus_section_id = v_z2, grading_category_id = v_gc2 WHERE id = v_a3;
  UPDATE public.assignments SET syllabus_section_id = v_z2, grading_category_id = v_gc3 WHERE id = v_a4;
  UPDATE public.assignments SET syllabus_section_id = v_z1, grading_category_id = v_gc4 WHERE id = v_a5;
  UPDATE public.assignments SET syllabus_section_id = v_z2, grading_category_id = v_gc5 WHERE id = v_a6;

  RAISE NOTICE 'Assignments mix seed OK: classroom %', v_classroom_id;
END $$;
