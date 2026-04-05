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
  v_teacher_id    uuid := '00000000-0000-0000-0000-000000000000'::uuid;  -- your teacher User UUID
  v_teacher_email  text := 'replace-with-teacher@example.com';             -- must match auth user email

  v_classroom_id   uuid := 'a1000000-0000-4000-8000-000000000101'::uuid;
  v_assign_essay   uuid := 'b2000000-0000-4000-8000-000000000201'::uuid;
  v_assign_project uuid := 'b2000000-0000-4000-8000-000000000202'::uuid;
  v_assign_pres    uuid := 'b2000000-0000-4000-8000-000000000203'::uuid;

  v_target jsonb := '{"vision": true, "values": true, "thinking": true, "connection": true, "action": false}'::jsonb;
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

  RAISE NOTICE 'Demo seed complete. Classroom % , assignments % / % / %',
    v_classroom_id, v_assign_essay, v_assign_project, v_assign_pres;
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
