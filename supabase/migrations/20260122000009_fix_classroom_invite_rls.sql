-- Fix classrooms_select policy to allow students to find classrooms by invite code
-- This migration updates the classrooms_select policy to allow authenticated users
-- to view classrooms that have an invite code, which is necessary for the join flow.

DROP POLICY IF EXISTS "classrooms_select" ON public.classrooms;

CREATE POLICY "classrooms_select" ON public.classrooms
  FOR SELECT TO authenticated
  USING (
    teacher_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.classroom_id = classrooms.id
      AND e.student_id = (select auth.uid())
    ) OR
    -- Allow finding by invite code during join process
    invite_code IS NOT NULL
  );
