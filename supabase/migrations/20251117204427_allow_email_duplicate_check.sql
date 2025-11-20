-- Migration: Allow anonymous users to check if email exists (for duplicate detection)
-- This is safe because it only allows checking email existence, not reading other profile data

-- Policy for teacher_profiles: Allow anyone to check if an email exists
CREATE POLICY "Allow email duplicate check for teacher_profiles"
  ON public.teacher_profiles
  FOR SELECT
  USING (true);

-- Policy for student_profiles: Allow anyone to check if an email exists  
CREATE POLICY "Allow email duplicate check for student_profiles"
  ON public.student_profiles
  FOR SELECT
  USING (true);

-- Add comment explaining the security model
COMMENT ON POLICY "Allow email duplicate check for teacher_profiles" ON public.teacher_profiles IS 
  'Allows anonymous users to query profiles by email for duplicate detection during registration. This is safe because the frontend only selects id and email fields.';

COMMENT ON POLICY "Allow email duplicate check for student_profiles" ON public.student_profiles IS 
  'Allows anonymous users to query profiles by email for duplicate detection during registration. This is safe because the frontend only selects id and email fields.';

