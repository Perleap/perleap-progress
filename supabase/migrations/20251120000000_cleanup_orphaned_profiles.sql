-- Migration: Clean up orphaned profiles and add function to prevent them
-- This handles cases where profiles exist but their auth user has been deleted

-- Function to clean up orphaned teacher profiles
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_teacher_profiles()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete teacher profiles where the user_id doesn't exist in auth.users
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up orphaned student profiles
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_student_profiles()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete student profiles where the user_id doesn't exist in auth.users
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up any existing orphaned profiles
DO $$
DECLARE
  teacher_count INTEGER;
  student_count INTEGER;
BEGIN
  SELECT public.cleanup_orphaned_teacher_profiles() INTO teacher_count;
  SELECT public.cleanup_orphaned_student_profiles() INTO student_count;
  
  IF teacher_count > 0 OR student_count > 0 THEN
    RAISE NOTICE 'Cleaned up % orphaned teacher profiles and % orphaned student profiles', 
      teacher_count, student_count;
  END IF;
END $$;

-- Add comments
COMMENT ON FUNCTION public.cleanup_orphaned_teacher_profiles() IS 
  'Removes teacher profiles where the associated auth user no longer exists';

COMMENT ON FUNCTION public.cleanup_orphaned_student_profiles() IS 
  'Removes student profiles where the associated auth user no longer exists';

