-- Verification Script: Check if all profiles have emails populated
-- Run this after the migration to verify all users have their emails

-- Check teacher profiles with missing emails
SELECT 
  'TEACHER PROFILES MISSING EMAIL' as status,
  COUNT(*) as count
FROM public.teacher_profiles
WHERE email IS NULL;

-- Check student profiles with missing emails
SELECT 
  'STUDENT PROFILES MISSING EMAIL' as status,
  COUNT(*) as count
FROM public.student_profiles
WHERE email IS NULL;

-- Show teacher profiles and their emails
SELECT 
  'TEACHER PROFILES' as type,
  tp.id,
  tp.user_id,
  tp.email,
  tp.full_name,
  au.email as auth_email,
  CASE 
    WHEN tp.email = au.email THEN '✓ Match'
    WHEN tp.email IS NULL THEN '✗ Missing'
    ELSE '⚠ Mismatch'
  END as status
FROM public.teacher_profiles tp
LEFT JOIN auth.users au ON tp.user_id = au.id
ORDER BY tp.created_at DESC;

-- Show student profiles and their emails
SELECT 
  'STUDENT PROFILES' as type,
  sp.id,
  sp.user_id,
  sp.email,
  sp.full_name,
  au.email as auth_email,
  CASE 
    WHEN sp.email = au.email THEN '✓ Match'
    WHEN sp.email IS NULL THEN '✗ Missing'
    ELSE '⚠ Mismatch'
  END as status
FROM public.student_profiles sp
LEFT JOIN auth.users au ON sp.user_id = au.id
ORDER BY sp.created_at DESC;

-- Summary statistics
SELECT 
  'SUMMARY' as report,
  (SELECT COUNT(*) FROM auth.users) as total_auth_users,
  (SELECT COUNT(*) FROM public.teacher_profiles) as total_teacher_profiles,
  (SELECT COUNT(*) FROM public.student_profiles) as total_student_profiles,
  (SELECT COUNT(*) FROM public.teacher_profiles WHERE email IS NOT NULL) as teachers_with_email,
  (SELECT COUNT(*) FROM public.student_profiles WHERE email IS NOT NULL) as students_with_email;

