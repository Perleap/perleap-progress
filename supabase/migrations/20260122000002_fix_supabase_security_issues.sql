-- Security Optimization Migration: Fix RLS, Mutable search_path, and Permissive Policies
-- Based on Supabase Security Linter reports

-- 1. Enable RLS on notifications table and set optimized policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
CREATE POLICY "notifications_insert_system" ON public.notifications
  FOR INSERT TO service_role
  WITH CHECK (true);


-- 2. Fix Mutable search_path in Functions
-- We re-define the functions with SET search_path = public for security

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_teacher_profiles()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.teacher_profiles
    WHERE user_id NOT IN (
      SELECT id FROM auth.users
    )
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_student_profiles()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.student_profiles
    WHERE user_id NOT IN (
      SELECT id FROM auth.users
    )
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.log_submission_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_teacher_id uuid;
  v_assignment_title text;
  v_student_name text;
  v_classroom_id uuid;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR 
     (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed') THEN
     
    SELECT a.title, a.classroom_id, c.teacher_id 
    INTO v_assignment_title, v_classroom_id, v_teacher_id
    FROM public.assignments a
    JOIN public.classrooms c ON a.classroom_id = c.id
    WHERE a.id = NEW.assignment_id;
    
    SELECT full_name INTO v_student_name
    FROM public.student_profiles
    WHERE user_id = NEW.student_id;
    
    INSERT INTO public.activity_events (
      teacher_id, 
      type, 
      entity_type, 
      entity_id, 
      title, 
      route
    ) VALUES (
      v_teacher_id,
      'create',
      'submission',
      NEW.id,
      coalesce(v_student_name, 'Student') || ' submitted ' || coalesce(v_assignment_title, 'Assignment'),
      '/teacher/submission/' || NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- 3. Tighten Permissive INSERT Policies
-- These were previously "TO authenticated, service_role" with "WITH CHECK (true)"
-- Restricting to service_role only as these are system-generated records.

DROP POLICY IF EXISTS "ai_evaluations_insert_system" ON public.ai_evaluations;
CREATE POLICY "ai_evaluations_insert_system" ON public.ai_evaluations
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "assignment_feedback_insert_system" ON public.assignment_feedback;
CREATE POLICY "assignment_feedback_insert_system" ON public.assignment_feedback
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "five_d_snapshots_insert_system" ON public.five_d_snapshots;
CREATE POLICY "five_d_snapshots_insert_system" ON public.five_d_snapshots
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "student_alerts_insert_system" ON public.student_alerts;
CREATE POLICY "student_alerts_insert_system" ON public.student_alerts
  FOR INSERT TO service_role
  WITH CHECK (true);
