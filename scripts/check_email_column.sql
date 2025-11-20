-- Quick Check: Verify email column exists and has data
-- Run this to check if the migration has been applied

-- Check if email column exists in teacher_profiles
SELECT 
  'teacher_profiles email column' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'teacher_profiles'
  AND column_name = 'email';

-- Check if email column exists in student_profiles
SELECT 
  'student_profiles email column' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'student_profiles'
  AND column_name = 'email';

-- Check teacher profiles: how many have emails?
SELECT 
  'teacher_profiles statistics' as report,
  COUNT(*) as total_profiles,
  COUNT(email) as profiles_with_email,
  COUNT(*) - COUNT(email) as profiles_missing_email
FROM public.teacher_profiles;

-- Check student profiles: how many have emails?
SELECT 
  'student_profiles statistics' as report,
  COUNT(*) as total_profiles,
  COUNT(email) as profiles_with_email,
  COUNT(*) - COUNT(email) as profiles_missing_email
FROM public.student_profiles;

-- Show sample data (first 5 profiles)
SELECT 
  'Sample teacher profiles' as type,
  id,
  user_id,
  email,
  full_name,
  created_at
FROM public.teacher_profiles
ORDER BY created_at DESC
LIMIT 5;

SELECT 
  'Sample student profiles' as type,
  id,
  user_id,
  email,
  full_name,
  created_at
FROM public.student_profiles
ORDER BY created_at DESC
LIMIT 5;

