-- =============================================================================
-- Demo: date_based release, units structure, climate + policy topic
-- Classroom: /teacher/classroom/a1000000-0000-4000-8000-000000000103
-- Invite: DATES1 (6 chars)
--
-- Section start_date gates visibility (see src/lib/sectionUnlock.ts).
-- Mix of past and future start_date so some units appear open and some closed
-- relative to "today" when you run this (tune dates as needed).
-- =============================================================================

DO $$
DECLARE
  v_teacher_id     uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_teacher_email  text := 'replace-with-teacher@example.com';

  v_classroom_id uuid := 'a1000000-0000-4000-8000-000000000103'::uuid;
  v_a1 uuid := 'b2000000-0000-4000-8000-000000000221'::uuid;
  v_a2 uuid := 'b2000000-0000-4000-8000-000000000222'::uuid;

  v_target jsonb := '{"vision": true, "values": true, "thinking": true, "connection": true, "action": true}'::jsonb;

  v_syllabus uuid := 'c3000000-0000-4000-8000-000000000303'::uuid;
  v_u1 uuid := 'd4000000-0000-4000-8000-000000000521'::uuid;
  v_u2 uuid := 'd4000000-0000-4000-8000-000000000522'::uuid;
  v_u3 uuid := 'd4000000-0000-4000-8000-000000000523'::uuid;
  v_u4 uuid := 'd4000000-0000-4000-8000-000000000524'::uuid;

  v_gc1 uuid := 'e5000000-0000-4000-8000-000000000621'::uuid;
  v_gc2 uuid := 'e5000000-0000-4000-8000-000000000622'::uuid;
  v_gc3 uuid := 'e5000000-0000-4000-8000-000000000623'::uuid;

  v_log uuid := 'f6000000-0000-4000-8000-000000000641'::uuid;
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
    'Climate Policy Lab',
    'Environmental studies',
    'DATES1',
    'Climate Policy Lab',
    '6 weeks',
    '2026-01-01', '2026-03-01',
    'Units track science summary → stakeholders → instrument design → debate.',
    'https://example.org/climate-lab',
    '["Summarize an IPCC statement for a lay reader","Compare two policy instruments"]'::jsonb,
    '["Jargon vs precision","Conflicting values"]'::jsonb,
    '[{"name": "Science communication", "components": ["Uncertainty", "Scenarios"]},
      {"name": "Governance", "components": ["Carbon pricing", "Standards"]}]'::jsonb,
    '[]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignments (id, classroom_id, title, type, instructions, due_at, status, target_dimensions, personalization_flag)
  VALUES
    (v_a1, v_classroom_id, 'Reading quiz: scenarios', 'test',
     '10 MCQ on SSP/RCP basics (from assigned FAQ).', '2026-02-10 23:59:59+00', 'published', v_target, false),
    (v_a2, v_classroom_id, 'Policy memo draft', 'text_essay',
     '800 words: recommend one instrument for your city; address one equity concern.', '2026-02-24 23:59:59+00', 'published', v_target, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabi (
    id, classroom_id, title, summary, structure_type, policies, release_mode,
    accent_color, banner_url, section_label_override, custom_settings,
    status, published_at
  )
  VALUES (
    v_syllabus, v_classroom_id,
    'Climate Policy Lab — Syllabus',
    'Date-gated units so readings unlock on a calendar cadence.',
    'units',
    '[
      {"id":"db-p1","type":"grading","label":"Grading","content":"Test 25 %, Memo 40 %, Debate + participation bundle 35 %.","order_index":0},
      {"id":"db-p2","type":"extra_credit","label":"Extra credit","content":"Optional op-ed revision (+2 %) if submitted within one week of feedback.","order_index":1}
    ]'::jsonb,
    'date_based',
    '#059669', NULL, 'Unit',
    '{"demoScenario": "date_based_units"}'::jsonb,
    'published', now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- start_date: Unit 1 always open (far past); Unit 2 open from early 2026; Unit 3 future; Unit 4 far future
  INSERT INTO public.syllabus_sections (
    id, syllabus_id, title, description, order_index, start_date, end_date,
    objectives, resources, notes, content, completion_status, prerequisites, is_locked
  )
  VALUES
    (v_u1, v_syllabus, 'Unit A — Physical basis (open)', 'Forcing, feedbacks, scenarios (intro).', 0,
     '2020-01-01', '2026-01-14',
     ARRAY['Define radiative forcing in one sentence', 'Contrast weather vs climate'],
     'IPCC SPM FAQ', NULL,
     '<p>Date-based: this unit uses a far-past <code>start_date</code> so it stays visible.</p>',
     'auto', '{}', false),
    (v_u2, v_syllabus, 'Unit B — Impacts (opens Jan 2026)', 'Regional risks; adaptation framing.', 1,
     '2026-01-15', '2026-01-31',
     ARRAY['Name two impact categories', 'Link one impact to a local example'],
     NULL, NULL,
     '<p>Opens mid-January 2026 (adjust if testing other windows).</p>',
     'auto', '{}', false),
    (v_u3, v_syllabus, 'Unit C — Mitigation instruments (future)', 'Pricing, standards, subsidies.', 2,
     '2026-12-01', '2026-12-15',
     ARRAY['Compare price vs quantity instruments', 'Identify a distributional effect'],
     NULL, NULL,
     '<p>Uses a December 2026 start_date so it stays locked until then.</p>',
     'auto', '{}', false),
    (v_u4, v_syllabus, 'Unit D — Debate week (far future)', 'Structured in-class debate + reflection.', 3,
     '2027-01-10', '2027-01-24',
     ARRAY['Deliver a timed rebuttal', 'Write a one-page reflection'],
     NULL, NULL,
     '<p>Far-future gate for “locked ahead” UI testing.</p>',
     'auto', '{}', false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.syllabus_changelog (id, syllabus_id, changed_by, change_summary, snapshot)
  VALUES (v_log, v_syllabus, v_teacher_id, 'Seed: date_based units with mixed start_date gates.', NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.grading_categories (id, syllabus_id, name, weight)
  VALUES
    (v_gc1, v_syllabus, 'Tests', 25),
    (v_gc2, v_syllabus, 'Memo', 40),
    (v_gc3, v_syllabus, 'Debate + participation', 35)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.assignments SET syllabus_section_id = v_u2, grading_category_id = v_gc1 WHERE id = v_a1;
  UPDATE public.assignments SET syllabus_section_id = v_u3, grading_category_id = v_gc2 WHERE id = v_a2;

  RAISE NOTICE 'Date-based units seed OK: classroom %', v_classroom_id;
END $$;
