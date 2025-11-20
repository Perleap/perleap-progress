-- Manual Script: Populate emails for existing users
-- Run this manually if needed to populate or fix email data

-- OPTION 1: Populate emails for teacher profiles where email is NULL
UPDATE public.teacher_profiles tp
SET email = au.email
FROM auth.users au
WHERE tp.user_id = au.id
  AND tp.email IS NULL;

-- OPTION 2: Populate emails for student profiles where email is NULL
UPDATE public.student_profiles sp
SET email = au.email
FROM auth.users au
WHERE sp.user_id = au.id
  AND sp.email IS NULL;

-- OPTION 3: Force update ALL emails (even if already populated) to ensure consistency
-- Uncomment the lines below if you need to refresh all emails

-- UPDATE public.teacher_profiles tp
-- SET email = au.email
-- FROM auth.users au
-- WHERE tp.user_id = au.id;

-- UPDATE public.student_profiles sp
-- SET email = au.email
-- FROM auth.users au
-- WHERE sp.user_id = au.id;

-- Verify the updates
SELECT 
  'Teachers updated' as status,
  COUNT(*) as count
FROM public.teacher_profiles
WHERE email IS NOT NULL;

SELECT 
  'Students updated' as status,
  COUNT(*) as count
FROM public.student_profiles
WHERE email IS NOT NULL;

