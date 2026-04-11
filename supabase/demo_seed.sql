-- =============================================================================
-- Perleap demo data — run once in Supabase SQL Editor (Dashboard → SQL).
-- Does NOT run automatically with migrations; safe to keep in repo.
--
-- Before running:
--   1. Open Supabase → Authentication → Users and copy your TEACHER account:
--      - User UUID  → v_teacher_id below
--      - Email      → v_teacher_email below
--   2. That user must be a teacher (same account you use to log into the app).
--
-- This script:
--   - Upserts teacher_profiles (required FK for classrooms.teacher_id)
--   - Inserts one classroom + three published assignments (fixed UUIDs, idempotent)
--   - Inserts a published syllabus with 4 sections, 3 grading categories
--   - Links assignments to syllabus sections and grading categories
--
-- After success: log in as that teacher → Teacher dashboard → open the classroom.
-- Deep link (same UUIDs every time): /teacher/classroom/a1000000-0000-4000-8000-000000000101
--
-- Invite code: must be exactly 6 characters (Student dashboard join dialog maxLength).
-- Already seeded with an old long code? Run in SQL Editor:
--   UPDATE public.classrooms SET invite_code = 'SYS001' WHERE id = 'a1000000-0000-4000-8000-000000000101';
-- =============================================================================

DO $$
DECLARE
  -- >>> REPLACE THESE TWO VALUES ONLY <<<
  v_teacher_id    uuid := 'cc467f71-c0a2-4ecf-9b6f-e6edc184ab38'::uuid;
  v_teacher_email  text := 'dor2468907@gmail.com';

  v_classroom_id   uuid := 'a1000000-0000-4000-8000-000000000101'::uuid;
  v_assign_essay   uuid := 'b2000000-0000-4000-8000-000000000201'::uuid;
  v_assign_project uuid := 'b2000000-0000-4000-8000-000000000202'::uuid;
  v_assign_pres    uuid := 'b2000000-0000-4000-8000-000000000203'::uuid;

  v_target jsonb := '{"vision": true, "values": true, "thinking": true, "connection": true, "action": false}'::jsonb;

  -- Syllabus IDs
  v_syllabus     uuid := 'c3000000-0000-4000-8000-000000000301'::uuid;
  v_sec_1        uuid := 'd4000000-0000-4000-8000-000000000401'::uuid;
  v_sec_2        uuid := 'd4000000-0000-4000-8000-000000000402'::uuid;
  v_sec_3        uuid := 'd4000000-0000-4000-8000-000000000403'::uuid;
  v_sec_4        uuid := 'd4000000-0000-4000-8000-000000000404'::uuid;
  v_gc_essays    uuid := 'e5000000-0000-4000-8000-000000000501'::uuid;
  v_gc_projects  uuid := 'e5000000-0000-4000-8000-000000000502'::uuid;
  v_gc_present   uuid := 'e5000000-0000-4000-8000-000000000503'::uuid;
BEGIN
  IF v_teacher_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Edit v_teacher_id and v_teacher_email at the top of this script (see comments).';
  END IF;

  -- 1) Teacher profile (FK target for classrooms.teacher_id)
  INSERT INTO public.teacher_profiles (user_id, email, full_name)
  VALUES (v_teacher_id, v_teacher_email, 'Demo Teacher (seed)')
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.teacher_profiles.full_name, EXCLUDED.full_name);

  -- 2) Classroom — "Systems & Society"
  INSERT INTO public.classrooms (
    id,
    teacher_id,
    name,
    subject,
    invite_code,
    course_title,
    course_duration,
    start_date,
    end_date,
    course_outline,
    resources,
    learning_outcomes,
    key_challenges,
    domains,
    materials
  )
  VALUES (
    v_classroom_id,
    v_teacher_id,
    'Systems & Society',
    'Interdisciplinary',
    'SYS001',
    'Systems & Society',
    '8 weeks',
    '2026-02-01',
    '2026-03-31',
    'Weeks 1–2: What is a system? Weeks 3–4: Feedback loops and evidence. Weeks 5–8: Values, stakeholders, and communicating recommendations.',
    'https://example.org/systems-literacy',
    '["Explain a feedback loop in plain language","Support a claim with two credible sources","Describe one tradeoff between stakeholder groups"]'::jsonb,
    '["Linking abstract models to local observations","Evaluating sources for credibility"]'::jsonb,
    '[
      {"name": "Systems thinking", "components": ["Feedback loops", "Boundaries and stocks"]},
      {"name": "Evidence literacy", "components": ["Claims vs data", "Uncertainty"]}
    ]'::jsonb,
    '[{"type": "link", "url": "https://example.org/ipcc-faq", "name": "IPCC FAQ (example)"}]'::jsonb
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3) Assignments (published)
  INSERT INTO public.assignments (
    id,
    classroom_id,
    title,
    type,
    instructions,
    due_at,
    status,
    target_dimensions,
    personalization_flag
  )
  VALUES (
    v_assign_essay,
    v_classroom_id,
    'Essay: Map a feedback loop',
    'text_essay',
    'In 400–600 words, describe one reinforcing or balancing feedback loop that affects your region (environment, economy, or health). Name the loop type and one source of uncertainty. Cite two reputable sources.',
    '2026-03-01 23:59:59+00',
    'published',
    v_target,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignments (
    id,
    classroom_id,
    title,
    type,
    instructions,
    due_at,
    status,
    target_dimensions,
    personalization_flag
  )
  VALUES (
    v_assign_project,
    v_classroom_id,
    'Project: Mini case study',
    'project',
    'Choose a local issue. Submit: (1) a simple system sketch, (2) two stakeholder perspectives, (3) one proposed intervention and its main risk, (4) a short bibliography (at least two sources).',
    '2026-03-20 23:59:59+00',
    'published',
    v_target,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.assignments (
    id,
    classroom_id,
    title,
    type,
    instructions,
    due_at,
    status,
    target_dimensions,
    personalization_flag
  )
  VALUES (
    v_assign_pres,
    v_classroom_id,
    'Presentation: Recommendation',
    'presentation',
    'Record or deliver a 5–7 minute presentation: problem → system view → tradeoff → one recommendation. Include one visual (diagram or slide image) and list two sources.',
    '2026-03-28 23:59:59+00',
    'published',
    v_target,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  -- 4) Syllabus (published, tied to the classroom)
  INSERT INTO public.syllabi (
    id, classroom_id, title, summary, structure_type,
    grading_policy_text, attendance_policy_text,
    late_work_policy_text, communication_policy_text,
    status, published_at
  )
  VALUES (
    v_syllabus,
    v_classroom_id,
    'Systems & Society — Course Syllabus',
    'An 8-week interdisciplinary course exploring systems thinking, evidence literacy, and ethical reasoning through local real-world problems.',
    'weeks',
    'Essays 40 %, Projects 35 %, Presentations 25 %. Rubrics shared before each assignment.',
    'Attendance is expected. Two unexcused absences allowed; each additional absence lowers the final grade by 5 %.',
    'Assignments accepted up to 3 days late with a 10 % penalty per day. Extensions granted with advance notice.',
    'Questions via the app or email. Responses within 24 hours on weekdays.',
    'published',
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 5) Syllabus sections (4 two-week blocks)
  INSERT INTO public.syllabus_sections (
    id, syllabus_id, title, description, order_index,
    start_date, end_date, objectives, resources, notes
  )
  VALUES
    (v_sec_1, v_syllabus,
     'Weeks 1–2: What is a system?',
     'Introduce stocks, flows, and boundaries. Students sketch a simple system map of a familiar process.',
     0, '2026-02-01', '2026-02-14',
     ARRAY['Define a system and its boundary', 'Identify stocks and flows in a real-world example'],
     'Ch. 1–2 of Thinking in Systems (Meadows)', NULL),

    (v_sec_2, v_syllabus,
     'Weeks 3–4: Feedback & evidence',
     'Reinforcing vs balancing loops. Reading data summaries; distinguishing claims from evidence.',
     1, '2026-02-15', '2026-02-28',
     ARRAY['Distinguish reinforcing and balancing feedback', 'Evaluate a data summary for credibility'],
     'IPCC FAQ + in-class data exercise', NULL),

    (v_sec_3, v_syllabus,
     'Weeks 5–6: Values & stakeholders',
     'Multiple perspectives, tradeoffs, fairness. Mini case-study research begins.',
     2, '2026-03-01', '2026-03-14',
     ARRAY['Describe a tradeoff between two stakeholder groups', 'Conduct a short stakeholder interview or case reading'],
     'Case study packet (provided)', NULL),

    (v_sec_4, v_syllabus,
     'Weeks 7–8: Action & showcase',
     'Propose interventions, assess risks, and present recommendations to the class.',
     3, '2026-03-15', '2026-03-31',
     ARRAY['Propose one concrete intervention with a stated risk', 'Deliver a clear 5–7 min presentation'],
     NULL, 'Final presentations in last session')
  ON CONFLICT (id) DO NOTHING;

  -- 6) Grading categories (must total 100)
  INSERT INTO public.grading_categories (id, syllabus_id, name, weight)
  VALUES
    (v_gc_essays,   v_syllabus, 'Essays',        40),
    (v_gc_projects, v_syllabus, 'Projects',      35),
    (v_gc_present,  v_syllabus, 'Presentations', 25)
  ON CONFLICT (id) DO NOTHING;

  -- 7) Link assignments → sections + grading categories
  UPDATE public.assignments
  SET syllabus_section_id = v_sec_2, grading_category_id = v_gc_essays
  WHERE id = v_assign_essay;

  UPDATE public.assignments
  SET syllabus_section_id = v_sec_3, grading_category_id = v_gc_projects
  WHERE id = v_assign_project;

  UPDATE public.assignments
  SET syllabus_section_id = v_sec_4, grading_category_id = v_gc_present
  WHERE id = v_assign_pres;

  RAISE NOTICE 'Demo seed complete. Classroom %, syllabus %, assignments % / % / %',
    v_classroom_id, v_syllabus, v_assign_essay, v_assign_project, v_assign_pres;
END $$;

-- =============================================================================
-- OPTIONAL — Student can see this class in the student app
-- Uncomment the block below, set v_student_id + v_student_email to a DIFFERENT
-- auth user (student account). Same email as teacher will violate unique email
-- on profiles; same user cannot have both teacher and student profiles.
-- =============================================================================
/*
DO $$
DECLARE
  v_classroom_id   uuid := 'a1000000-0000-4000-8000-000000000101'::uuid;
  v_student_id     uuid := '00000000-0000-0000-0000-000000000000'::uuid;  -- student User UUID
  v_student_email   text := 'replace-with-student@example.com';
BEGIN
  IF v_student_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Set v_student_id and v_student_email in the optional block.';
  END IF;

  INSERT INTO public.student_profiles (user_id, email, full_name)
  VALUES (v_student_id, v_student_email, 'Demo Student (seed)')
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.student_profiles.full_name, EXCLUDED.full_name);

  INSERT INTO public.enrollments (classroom_id, student_id)
  VALUES (v_classroom_id, v_student_id)
  ON CONFLICT (classroom_id, student_id) DO NOTHING;
END $$;
*/
