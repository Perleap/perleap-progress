-- Migration: Prevent users from having both teacher and student profiles
-- This migration adds a database-level constraint to ensure users can only have ONE profile type

-- Function to check if user already has a profile in the other table
CREATE OR REPLACE FUNCTION public.check_single_profile_constraint()
RETURNS TRIGGER AS $$
BEGIN
  -- If inserting into teacher_profiles, check if user has a student_profile
  IF TG_TABLE_NAME = 'teacher_profiles' THEN
    IF EXISTS (
      SELECT 1 FROM public.student_profiles 
      WHERE user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'User already has a student profile. Cannot create teacher profile.'
        USING HINT = 'A user can only have one role (either teacher or student)';
    END IF;
  END IF;

  -- If inserting into student_profiles, check if user has a teacher_profile
  IF TG_TABLE_NAME = 'student_profiles' THEN
    IF EXISTS (
      SELECT 1 FROM public.teacher_profiles 
      WHERE user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'User already has a teacher profile. Cannot create student profile.'
        USING HINT = 'A user can only have one role (either teacher or student)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger to teacher_profiles table
DROP TRIGGER IF EXISTS prevent_duplicate_profile_teacher ON public.teacher_profiles;
CREATE TRIGGER prevent_duplicate_profile_teacher
  BEFORE INSERT ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_single_profile_constraint();

-- Add trigger to student_profiles table
DROP TRIGGER IF EXISTS prevent_duplicate_profile_student ON public.student_profiles;
CREATE TRIGGER prevent_duplicate_profile_student
  BEFORE INSERT ON public.student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_single_profile_constraint();

-- Add comment for documentation
COMMENT ON FUNCTION public.check_single_profile_constraint() IS 
  'Ensures that a user can only have either a teacher_profile OR a student_profile, but not both';

