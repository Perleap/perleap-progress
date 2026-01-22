-- Fix 500 Errors and RLS Recursion
-- This migration replaces recursive RLS policies with Security Definer functions
-- which bypass RLS checks internally, breaking the recursion loops.

-- 1. Create helper functions to check relationships safely
CREATE OR REPLACE FUNCTION public.check_is_teacher_of_student(teacher_uuid uuid, student_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.classrooms c
    JOIN public.enrollments e ON e.classroom_id = c.id
    WHERE c.teacher_id = teacher_uuid AND e.student_id = student_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_is_enrolled(student_uuid uuid, classroom_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE student_id = student_uuid AND classroom_id = classroom_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_owns_classroom(teacher_uuid uuid, classroom_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.classrooms
    WHERE teacher_id = teacher_uuid AND id = classroom_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. Update teacher_profiles
DROP POLICY IF EXISTS "teacher_profiles_select" ON public.teacher_profiles;
CREATE POLICY "teacher_profiles_select" ON public.teacher_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    public.check_is_teacher_of_student(user_id, (select auth.uid()))
  );

-- 3. Update student_profiles
DROP POLICY IF EXISTS "student_profiles_select" ON public.student_profiles;
CREATE POLICY "student_profiles_select" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    public.check_is_teacher_of_student((select auth.uid()), user_id)
  );

-- 4. Update classrooms
DROP POLICY IF EXISTS "classrooms_select" ON public.classrooms;
CREATE POLICY "classrooms_select" ON public.classrooms
  FOR SELECT TO authenticated
  USING (
    teacher_id = (select auth.uid()) OR
    public.check_is_enrolled((select auth.uid()), id)
  );

-- 5. Update enrollments
DROP POLICY IF EXISTS "enrollments_select" ON public.enrollments;
CREATE POLICY "enrollments_select" ON public.enrollments
  FOR SELECT TO authenticated
  USING (
    student_id = (select auth.uid()) OR
    public.check_owns_classroom((select auth.uid()), classroom_id)
  );

-- 6. Update assignments
DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
CREATE POLICY "assignments_select" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    public.check_owns_classroom((select auth.uid()), classroom_id) OR
    (
      status = 'published' AND
      public.check_is_enrolled((select auth.uid()), classroom_id)
    )
  );

-- 7. Update submissions
DROP POLICY IF EXISTS "submissions_select" ON public.submissions;
CREATE POLICY "submissions_select" ON public.submissions
  FOR SELECT TO authenticated
  USING (
    student_id = (select auth.uid()) OR
    public.check_owns_classroom((select auth.uid()), (SELECT classroom_id FROM public.assignments WHERE id = assignment_id))
  );
