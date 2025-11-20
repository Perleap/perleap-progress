-- Manual cleanup script for orphaned profiles
-- Run this in your Supabase SQL Editor or local database

-- 1. First, let's see what orphaned profiles exist
SELECT 
  'teacher_profiles' as table_name,
  tp.id,
  tp.email,
  tp.user_id,
  tp.created_at,
  CASE WHEN au.id IS NULL THEN 'ORPHANED' ELSE 'VALID' END as status
FROM public.teacher_profiles tp
LEFT JOIN auth.users au ON tp.user_id = au.id
WHERE au.id IS NULL;

SELECT 
  'student_profiles' as table_name,
  sp.id,
  sp.email,
  sp.user_id,
  sp.created_at,
  CASE WHEN au.id IS NULL THEN 'ORPHANED' ELSE 'VALID' END as status
FROM public.student_profiles sp
LEFT JOIN auth.users au ON sp.user_id = au.id
WHERE au.id IS NULL;

-- 2. Now delete the orphaned teacher profiles
DELETE FROM public.teacher_profiles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 3. Delete the orphaned student profiles
DELETE FROM public.student_profiles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 4. Verify cleanup
SELECT 
  (SELECT COUNT(*) FROM public.teacher_profiles tp 
   LEFT JOIN auth.users au ON tp.user_id = au.id 
   WHERE au.id IS NULL) as orphaned_teacher_profiles,
  (SELECT COUNT(*) FROM public.student_profiles sp 
   LEFT JOIN auth.users au ON sp.user_id = au.id 
   WHERE au.id IS NULL) as orphaned_student_profiles;

