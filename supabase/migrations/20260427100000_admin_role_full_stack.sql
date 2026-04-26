-- Admin role: app_admins (source of truth), RLS helpers, policy updates, audit log, storage.

-- 1) Enum (idempotent; metadata / future typed columns)
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
      AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'admin';
  END IF;
END
$enum$;

-- 2) app_admins: no policies — only SECURITY DEFINER functions read this table
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- So authenticated users can confirm their own admin row and sync user_metadata in the app (RLS is still the real gate for data).
CREATE POLICY "app_admins_select_own_row"
  ON public.app_admins
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

COMMENT ON TABLE public.app_admins IS 'Application admins. Inserts only via service role or migration. SELECT own row for metadata sync in the app.';

-- 3) is_app_admin (before any policy references it)
CREATE OR REPLACE FUNCTION public.is_app_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_admins a
    WHERE a.user_id = _user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_app_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_app_admin(uuid) TO anon;

-- 4) Audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_audit_log_insert"
  ON public.admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_user_id = (select auth.uid())
    AND public.is_app_admin((select auth.uid()))
  );

CREATE POLICY "admin_audit_log_select"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin((select auth.uid())));

COMMENT ON TABLE public.admin_audit_log IS 'Optional append-only style audit for app admin actions.';

-- 5) Core RLS helpers
CREATE OR REPLACE FUNCTION public.check_owns_classroom(teacher_uuid uuid, classroom_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_app_admin(teacher_uuid) THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.classrooms
      WHERE id = classroom_uuid
        AND active = true
    );
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.classrooms
    WHERE id = classroom_uuid
      AND teacher_id = teacher_uuid
      AND active = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_classroom_teacher(_classroom_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    public.is_app_admin(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.classrooms
      WHERE id = _classroom_id
        AND active = true
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.classrooms
    WHERE id = _classroom_id
      AND teacher_id = _user_id
      AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_teacher_of_student(teacher_uuid uuid, student_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_app_admin(teacher_uuid) OR public.is_app_admin(student_uuid) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.classrooms c
    JOIN public.enrollments e ON e.classroom_id = c.id
    WHERE c.teacher_id = teacher_uuid
      AND e.student_id = student_uuid
      AND c.active = true
      AND e.active = true
  );
END;
$$;

-- 6) Classrooms: latest shape from 20260425100000
DROP POLICY IF EXISTS "classrooms_select" ON public.classrooms;
CREATE POLICY "classrooms_select" ON public.classrooms
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR teacher_id = (select auth.uid())
    OR (
      active = true
      AND (
        public.check_is_enrolled((select auth.uid()), id)
        OR invite_code IS NOT NULL
      )
    )
  );

DROP POLICY IF EXISTS "classrooms_update" ON public.classrooms;
CREATE POLICY "classrooms_update" ON public.classrooms
  FOR UPDATE TO authenticated
  USING (
    teacher_id = (select auth.uid())
    OR public.is_app_admin((select auth.uid()))
  )
  WITH CHECK (
    teacher_id = (select auth.uid())
    OR public.is_app_admin((select auth.uid()))
  );

-- 7) Profiles: keep check_is + explicit admin
DROP POLICY IF EXISTS "teacher_profiles_select" ON public.teacher_profiles;
CREATE POLICY "teacher_profiles_select" ON public.teacher_profiles
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR user_id = (select auth.uid())
    OR public.check_is_teacher_of_student(user_id, (select auth.uid()))
  );

DROP POLICY IF EXISTS "student_profiles_select" ON public.student_profiles;
CREATE POLICY "student_profiles_select" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR user_id = (select auth.uid())
    OR public.check_is_teacher_of_student((select auth.uid()), user_id)
  );

-- 8) Submissions (in-class teacher path; check_owns also covers admin via extended helper)
DROP POLICY IF EXISTS "submissions_select" ON public.submissions;
CREATE POLICY "submissions_select" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.assignments a
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
        AND a.active = true
        AND c.active = true
        AND (
          submissions.student_id = (select auth.uid())
          OR c.teacher_id = (select auth.uid())
          OR public.is_app_admin((select auth.uid()))
        )
    )
  );

-- 9) Essay feedback + submission release (20260405)
DROP POLICY IF EXISTS "assignment_feedback_select" ON public.assignment_feedback;
CREATE POLICY "assignment_feedback_select" ON public.assignment_feedback
  FOR SELECT TO authenticated
  USING (
    (
      student_id = (select auth.uid())
      AND visible_to_student = true
    )
    OR
    public.is_app_admin((select auth.uid()))
    OR
    EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_feedback.assignment_id
        AND c.teacher_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "assignment_feedback_update_teacher" ON public.assignment_feedback;
CREATE POLICY "assignment_feedback_update_teacher" ON public.assignment_feedback
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_feedback.assignment_id
        AND c.teacher_id = (select auth.uid())
    )
  )
  WITH CHECK (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_feedback.assignment_id
        AND c.teacher_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "submissions_update_teacher" ON public.submissions;
CREATE POLICY "submissions_update_teacher" ON public.submissions
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
        AND c.teacher_id = (select auth.uid())
    )
  )
  WITH CHECK (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
        AND c.teacher_id = (select auth.uid())
    )
  );

-- 10) ai_evaluations, five_d, hard skills, chat, alerts, activities, AI plans
DROP POLICY IF EXISTS "ai_evaluations_select" ON public.ai_evaluations;
CREATE POLICY "ai_evaluations_select" ON public.ai_evaluations
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.submissions s
      LEFT JOIN public.assignments a ON a.id = s.assignment_id
      LEFT JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = ai_evaluations.submission_id
        AND (
          s.student_id = (select auth.uid())
          OR c.teacher_id = (select auth.uid())
        )
    )
  );

-- five_d_snapshots
DROP POLICY IF EXISTS "five_d_snapshots_select" ON public.five_d_snapshots;
CREATE POLICY "five_d_snapshots_select" ON public.five_d_snapshots
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.classrooms c
      INNER JOIN public.enrollments e ON e.classroom_id = c.id
      WHERE c.teacher_id = (select auth.uid())
        AND e.student_id = five_d_snapshots.user_id
        AND (five_d_snapshots.classroom_id IS NULL OR five_d_snapshots.classroom_id = c.id)
    )
  );

-- hard_skill_assessments
DROP POLICY IF EXISTS "hard_skill_assessments_select" ON public.hard_skill_assessments;
CREATE POLICY "hard_skill_assessments_select" ON public.hard_skill_assessments
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR student_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = hard_skill_assessments.assignment_id
        AND c.teacher_id = (select auth.uid())
    )
  );

-- assignment_chat_history
DROP POLICY IF EXISTS "assignment_chat_history_select" ON public.assignment_chat_history;
CREATE POLICY "assignment_chat_history_select" ON public.assignment_chat_history
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.submissions sub
      JOIN public.assignments a ON a.id = sub.assignment_id
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE sub.id = assignment_chat_history.submission_id
        AND c.teacher_id = (select auth.uid())
    )
  );

-- student_alerts
DROP POLICY IF EXISTS "student_alerts_select" ON public.student_alerts;
CREATE POLICY "student_alerts_select" ON public.student_alerts
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON a.classroom_id = c.id
      WHERE a.id = student_alerts.assignment_id
        AND c.teacher_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "student_alerts_update" ON public.student_alerts;
CREATE POLICY "student_alerts_update" ON public.student_alerts
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON a.classroom_id = c.id
      WHERE a.id = student_alerts.assignment_id
        AND c.teacher_id = (select auth.uid())
    )
  );

-- activity_events
DROP POLICY IF EXISTS "activity_events_select" ON public.activity_events;
CREATE POLICY "activity_events_select" ON public.activity_events
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR teacher_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "activity_events_insert" ON public.activity_events;
CREATE POLICY "activity_events_insert" ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin((select auth.uid()))
    OR teacher_id = (select auth.uid())
  );

-- ai_lesson_plans
DROP POLICY IF EXISTS "ai_lesson_plans_select" ON public.ai_lesson_plans;
CREATE POLICY "ai_lesson_plans_select" ON public.ai_lesson_plans
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR teacher_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "ai_lesson_plans_insert" ON public.ai_lesson_plans;
CREATE POLICY "ai_lesson_plans_insert" ON public.ai_lesson_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin((select auth.uid()))
    OR teacher_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "ai_lesson_plans_update" ON public.ai_lesson_plans;
CREATE POLICY "ai_lesson_plans_update" ON public.ai_lesson_plans
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR teacher_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "ai_lesson_plans_delete" ON public.ai_lesson_plans;
CREATE POLICY "ai_lesson_plans_delete" ON public.ai_lesson_plans
  FOR DELETE TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR teacher_id = (select auth.uid())
  );

-- 11) assignment_conversations teacher branch
DROP POLICY IF EXISTS "assignment_conversations_select_teacher" ON public.assignment_conversations;
CREATE POLICY "assignment_conversations_select_teacher" ON public.assignment_conversations
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_conversations.assignment_id
        AND c.teacher_id = (select auth.uid())
    )
  );

-- 12) Nuance
DROP POLICY IF EXISTS "Teachers can read nuance events for their students" ON public.student_nuance_events;
CREATE POLICY "Teachers can read nuance events for their students" ON public.student_nuance_events
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = student_nuance_events.assignment_id
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can read nuance metrics for their classrooms" ON public.student_nuance_metrics;
CREATE POLICY "Teachers can read nuance metrics for their classrooms" ON public.student_nuance_metrics
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.classrooms c
      WHERE c.id = student_nuance_metrics.classroom_id
        AND c.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can read recommendations for their classrooms" ON public.student_recommendations;
CREATE POLICY "Teachers can read recommendations for their classrooms" ON public.student_recommendations
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin((select auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.classrooms c
      WHERE c.id = student_recommendations.classroom_id
        AND c.teacher_id = auth.uid()
    )
  );

-- 13) Storage: syllabus (is_classroom_teacher extended); avatars: admin can manage any folder in bucket
DROP POLICY IF EXISTS "Admins can upload to teacher-avatars" ON storage.objects;
CREATE POLICY "Admins can upload to teacher-avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'teacher-avatars'
    AND public.is_app_admin((select auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can update teacher-avatars" ON storage.objects;
CREATE POLICY "Admins can update teacher-avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'teacher-avatars' AND public.is_app_admin((select auth.uid())));

DROP POLICY IF EXISTS "Admins can delete teacher-avatars" ON storage.objects;
CREATE POLICY "Admins can delete teacher-avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'teacher-avatars' AND public.is_app_admin((select auth.uid())));

DROP POLICY IF EXISTS "Admins can upload to student-avatars" ON storage.objects;
CREATE POLICY "Admins can upload to student-avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-avatars'
    AND public.is_app_admin((select auth.uid()))
  );

DROP POLICY IF EXISTS "Admins can update student-avatars" ON storage.objects;
CREATE POLICY "Admins can update student-avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'student-avatars' AND public.is_app_admin((select auth.uid())));

DROP POLICY IF EXISTS "Admins can delete student-avatars" ON storage.objects;
CREATE POLICY "Admins can delete student-avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'student-avatars' AND public.is_app_admin((select auth.uid())));
