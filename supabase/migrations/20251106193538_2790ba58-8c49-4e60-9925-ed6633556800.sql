-- Create security definer function to check if user is teacher of a classroom
CREATE OR REPLACE FUNCTION public.is_classroom_teacher(_classroom_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classrooms
    WHERE id = _classroom_id
      AND teacher_id = _user_id
  )
$$;

-- Create security definer function to check if user is enrolled in a classroom
CREATE OR REPLACE FUNCTION public.is_enrolled_in_classroom(_classroom_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.enrollments
    WHERE classroom_id = _classroom_id
      AND student_id = _user_id
  )
$$;

-- Drop and recreate the problematic policies
DROP POLICY IF EXISTS "Teachers can view enrollments in their classrooms" ON public.enrollments;
DROP POLICY IF EXISTS "Students can view classrooms they're enrolled in" ON public.classrooms;

-- Recreate enrollment policy for teachers using security definer function
CREATE POLICY "Teachers can view enrollments in their classrooms"
ON public.enrollments
FOR SELECT
USING (public.is_classroom_teacher(classroom_id, auth.uid()));

-- Recreate classroom policy for students using security definer function
CREATE POLICY "Students can view classrooms they're enrolled in"
ON public.classrooms
FOR SELECT
USING (public.is_enrolled_in_classroom(id, auth.uid()));