-- Optimization Migration: Optimize RLS Performance and Security
-- 1. Replace auth.uid() with (select auth.uid()) for better performance
-- 2. Combine multiple permissive SELECT policies into single policies
-- 3. Explicitly set roles (authenticated/anon)

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
    -- teacher_profiles
    DROP POLICY IF EXISTS "Users can view their own teacher profile" ON public.teacher_profiles;
    DROP POLICY IF EXISTS "Users can create their own teacher profile" ON public.teacher_profiles;
    DROP POLICY IF EXISTS "Users can update their own teacher profile" ON public.teacher_profiles;
    DROP POLICY IF EXISTS "Students can view their teachers' profiles" ON public.teacher_profiles;
    DROP POLICY IF EXISTS "Allow email duplicate check for teacher_profiles" ON public.teacher_profiles;

    -- student_profiles
    DROP POLICY IF EXISTS "Users can view their own student profile" ON public.student_profiles;
    DROP POLICY IF EXISTS "Users can create their own student profile" ON public.student_profiles;
    DROP POLICY IF EXISTS "Users can update their own student profile" ON public.student_profiles;
    DROP POLICY IF EXISTS "Teachers can view enrolled student profiles" ON public.student_profiles;
    DROP POLICY IF EXISTS "Allow email duplicate check for student_profiles" ON public.student_profiles;

    -- classrooms
    DROP POLICY IF EXISTS "Teachers can view their own classrooms" ON public.classrooms;
    DROP POLICY IF EXISTS "Teachers can create classrooms" ON public.classrooms;
    DROP POLICY IF EXISTS "Teachers can update their own classrooms" ON public.classrooms;
    DROP POLICY IF EXISTS "Teachers can delete their own classrooms" ON public.classrooms;
    DROP POLICY IF EXISTS "Students can view classrooms they're enrolled in" ON public.classrooms;
    DROP POLICY IF EXISTS "Anyone can find classrooms by invite code" ON public.classrooms;

    -- enrollments
    DROP POLICY IF EXISTS "Teachers can view enrollments in their classrooms" ON public.enrollments;
    DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.enrollments;
    DROP POLICY IF EXISTS "Students can create their own enrollments" ON public.enrollments;

    -- assignments
    DROP POLICY IF EXISTS "Teachers can manage assignments in their classrooms" ON public.assignments;
    DROP POLICY IF EXISTS "Students can view published assignments in enrolled classrooms" ON public.assignments;

    -- submissions
    DROP POLICY IF EXISTS "Students can manage their own submissions" ON public.submissions;
    DROP POLICY IF EXISTS "Teachers can view submissions in their classrooms" ON public.submissions;

    -- ai_evaluations
    DROP POLICY IF EXISTS "Students can view evaluations of their submissions" ON public.ai_evaluations;
    DROP POLICY IF EXISTS "Teachers can view evaluations in their classrooms" ON public.ai_evaluations;
    DROP POLICY IF EXISTS "System can create evaluations" ON public.ai_evaluations;

    -- assignment_feedback
    DROP POLICY IF EXISTS "Students can view their own feedback" ON public.assignment_feedback;
    DROP POLICY IF EXISTS "Teachers can view feedback for their assignments" ON public.assignment_feedback;
    DROP POLICY IF EXISTS "System can create feedback" ON public.assignment_feedback;

    -- five_d_snapshots
    DROP POLICY IF EXISTS "Users can view their own snapshots" ON public.five_d_snapshots;
    DROP POLICY IF EXISTS "System can create snapshots" ON public.five_d_snapshots;
    DROP POLICY IF EXISTS "Teachers can view snapshots of enrolled students" ON public.five_d_snapshots;
    DROP POLICY IF EXISTS "Teachers can view snapshots of enrolled students in their classrooms" ON public.five_d_snapshots;

    -- hard_skill_assessments
    DROP POLICY IF EXISTS "Students can view their own hard skill assessments" ON public.hard_skill_assessments;
    DROP POLICY IF EXISTS "Teachers can view assessments in their classrooms" ON public.hard_skill_assessments;
    DROP POLICY IF EXISTS "Service role can insert hard skill assessments" ON public.hard_skill_assessments;

    -- assignment_chat_history
    DROP POLICY IF EXISTS "Students can view their own chat history" ON public.assignment_chat_history;
    DROP POLICY IF EXISTS "Students can insert their own messages" ON public.assignment_chat_history;
    DROP POLICY IF EXISTS "Teachers can view chat history for their assignments" ON public.assignment_chat_history;

    -- assignment_conversations
    DROP POLICY IF EXISTS "Students can view their own conversations" ON public.assignment_conversations;
    DROP POLICY IF EXISTS "Students can create their own conversations" ON public.assignment_conversations;
    DROP POLICY IF EXISTS "Students can update their own conversations" ON public.assignment_conversations;

    -- activity_events
    DROP POLICY IF EXISTS "Teachers can view their own activity" ON public.activity_events;
    DROP POLICY IF EXISTS "Teachers can insert their own activity" ON public.activity_events;

    -- student_alerts
    DROP POLICY IF EXISTS "Teachers can view alerts for their students" ON public.student_alerts;
    DROP POLICY IF EXISTS "Teachers can acknowledge alerts" ON public.student_alerts;
    DROP POLICY IF EXISTS "System can create alerts" ON public.student_alerts;

    -- ai_lesson_plans
    DROP POLICY IF EXISTS "Teachers can manage their own lesson plans" ON public.ai_lesson_plans;

    -- teacher_reviews
    DROP POLICY IF EXISTS "Teachers can manage reviews they created" ON public.teacher_reviews;
END $$;


-- NEW OPTIMIZED POLICIES --

-- teacher_profiles
CREATE POLICY "teacher_profiles_select" ON public.teacher_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.classrooms c
      INNER JOIN public.enrollments e ON e.classroom_id = c.id
      WHERE c.teacher_id = teacher_profiles.user_id
      AND e.student_id = (select auth.uid())
    )
  );

CREATE POLICY "teacher_profiles_duplicate_check" ON public.teacher_profiles
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "teacher_profiles_insert" ON public.teacher_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "teacher_profiles_update" ON public.teacher_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));


-- student_profiles
CREATE POLICY "student_profiles_select" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.classrooms c
      INNER JOIN public.enrollments e ON e.classroom_id = c.id
      WHERE c.teacher_id = (select auth.uid())
      AND e.student_id = student_profiles.user_id
    )
  );

CREATE POLICY "student_profiles_duplicate_check" ON public.student_profiles
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "student_profiles_insert" ON public.student_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "student_profiles_update" ON public.student_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));


-- classrooms
CREATE POLICY "classrooms_select" ON public.classrooms
  FOR SELECT TO authenticated
  USING (
    teacher_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.classroom_id = classrooms.id
      AND e.student_id = (select auth.uid())
    )
  );

CREATE POLICY "classrooms_invite_check" ON public.classrooms
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "classrooms_insert" ON public.classrooms
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = (select auth.uid()));

CREATE POLICY "classrooms_update" ON public.classrooms
  FOR UPDATE TO authenticated
  USING (teacher_id = (select auth.uid()));

CREATE POLICY "classrooms_delete" ON public.classrooms
  FOR DELETE TO authenticated
  USING (teacher_id = (select auth.uid()));


-- enrollments
CREATE POLICY "enrollments_select" ON public.enrollments
  FOR SELECT TO authenticated
  USING (
    student_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = enrollments.classroom_id
      AND c.teacher_id = (select auth.uid())
    )
  );

CREATE POLICY "enrollments_insert" ON public.enrollments
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));


-- assignments
CREATE POLICY "assignments_select" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = assignments.classroom_id
      AND (
        c.teacher_id = (select auth.uid()) OR
        (
          assignments.status = 'published' AND
          EXISTS (
            SELECT 1 FROM public.enrollments e
            WHERE e.classroom_id = c.id
            AND e.student_id = (select auth.uid())
          )
        )
      )
    )
  );

CREATE POLICY "assignments_insert_teacher" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = assignments.classroom_id
      AND c.teacher_id = (select auth.uid())
    )
  );

CREATE POLICY "assignments_update_teacher" ON public.assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = assignments.classroom_id
      AND c.teacher_id = (select auth.uid())
    )
  );

CREATE POLICY "assignments_delete_teacher" ON public.assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = assignments.classroom_id
      AND c.teacher_id = (select auth.uid())
    )
  );


-- submissions
CREATE POLICY "submissions_select" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    student_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.assignments a
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  );

CREATE POLICY "submissions_insert_student" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));

CREATE POLICY "submissions_update_student" ON public.submissions
  FOR UPDATE TO authenticated
  USING (student_id = (select auth.uid()));

CREATE POLICY "submissions_delete_student" ON public.submissions
  FOR DELETE TO authenticated
  USING (student_id = (select auth.uid()));


-- ai_evaluations
CREATE POLICY "ai_evaluations_select" ON public.ai_evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      LEFT JOIN public.assignments a ON a.id = s.assignment_id
      LEFT JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = ai_evaluations.submission_id
      AND (
        s.student_id = (select auth.uid()) OR
        c.teacher_id = (select auth.uid())
      )
    )
  );

CREATE POLICY "ai_evaluations_insert_system" ON public.ai_evaluations
  FOR INSERT TO authenticated, service_role
  WITH CHECK (true);


-- assignment_feedback
CREATE POLICY "assignment_feedback_select" ON public.assignment_feedback
  FOR SELECT TO authenticated
  USING (
    student_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = assignment_feedback.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  );

CREATE POLICY "assignment_feedback_insert_system" ON public.assignment_feedback
  FOR INSERT TO authenticated, service_role
  WITH CHECK (true);


-- five_d_snapshots
CREATE POLICY "five_d_snapshots_select" ON public.five_d_snapshots
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.classrooms c
      INNER JOIN public.enrollments e ON e.classroom_id = c.id
      WHERE c.teacher_id = (select auth.uid())
      AND e.student_id = five_d_snapshots.user_id
      AND (five_d_snapshots.classroom_id IS NULL OR five_d_snapshots.classroom_id = c.id)
    )
  );

CREATE POLICY "five_d_snapshots_insert_system" ON public.five_d_snapshots
  FOR INSERT TO authenticated, service_role
  WITH CHECK (true);


-- hard_skill_assessments
CREATE POLICY "hard_skill_assessments_select" ON public.hard_skill_assessments
  FOR SELECT TO authenticated
  USING (
    student_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = hard_skill_assessments.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  );

CREATE POLICY "hard_skill_assessments_insert_service" ON public.hard_skill_assessments
  FOR INSERT TO service_role
  WITH CHECK (true);


-- assignment_chat_history
CREATE POLICY "assignment_chat_history_select" ON public.assignment_chat_history
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.submissions sub
      JOIN public.assignments a ON a.id = sub.assignment_id
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE sub.id = assignment_chat_history.submission_id
      AND c.teacher_id = (select auth.uid())
    )
  );

CREATE POLICY "assignment_chat_history_insert_student" ON public.assignment_chat_history
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));


-- assignment_conversations
CREATE POLICY "assignment_conversations_select" ON public.assignment_conversations
  FOR SELECT TO authenticated
  USING (student_id = (select auth.uid()));

CREATE POLICY "assignment_conversations_insert" ON public.assignment_conversations
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (select auth.uid()));

CREATE POLICY "assignment_conversations_update" ON public.assignment_conversations
  FOR UPDATE TO authenticated
  USING (student_id = (select auth.uid()));


-- activity_events
CREATE POLICY "activity_events_select" ON public.activity_events
  FOR SELECT TO authenticated
  USING (teacher_id = (select auth.uid()));

CREATE POLICY "activity_events_insert" ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = (select auth.uid()));


-- student_alerts
CREATE POLICY "student_alerts_select" ON public.student_alerts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON a.classroom_id = c.id
      WHERE a.id = student_alerts.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  );

CREATE POLICY "student_alerts_update" ON public.student_alerts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON a.classroom_id = c.id
      WHERE a.id = student_alerts.assignment_id
      AND c.teacher_id = (select auth.uid())
    )
  );

CREATE POLICY "student_alerts_insert_system" ON public.student_alerts
  FOR INSERT TO authenticated, service_role
  WITH CHECK (true);


-- ai_lesson_plans
CREATE POLICY "ai_lesson_plans_select" ON public.ai_lesson_plans
  FOR SELECT TO authenticated
  USING (teacher_id = (select auth.uid()));

CREATE POLICY "ai_lesson_plans_insert" ON public.ai_lesson_plans
  FOR INSERT TO authenticated
  WITH CHECK (teacher_id = (select auth.uid()));

CREATE POLICY "ai_lesson_plans_update" ON public.ai_lesson_plans
  FOR UPDATE TO authenticated
  USING (teacher_id = (select auth.uid()));

CREATE POLICY "ai_lesson_plans_delete" ON public.ai_lesson_plans
  FOR DELETE TO authenticated
  USING (teacher_id = (select auth.uid()));


-- teacher_reviews
CREATE POLICY "teacher_reviews_select" ON public.teacher_reviews
  FOR SELECT TO authenticated
  USING (reviewer_id = (select auth.uid()));

CREATE POLICY "teacher_reviews_insert" ON public.teacher_reviews
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = (select auth.uid()));

CREATE POLICY "teacher_reviews_update" ON public.teacher_reviews
  FOR UPDATE TO authenticated
  USING (reviewer_id = (select auth.uid()));

CREATE POLICY "teacher_reviews_delete" ON public.teacher_reviews
  FOR DELETE TO authenticated
  USING (reviewer_id = (select auth.uid()));
