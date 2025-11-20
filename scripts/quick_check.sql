-- QUICK CHECK: Run this in Supabase SQL Editor
-- This will tell us if the email column exists and has data

-- 1. Check if email column exists
SELECT 
  'Column Check' as test,
  EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'teacher_profiles' 
    AND column_name = 'email'
  ) as teacher_has_email_column,
  EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'student_profiles' 
    AND column_name = 'email'
  ) as student_has_email_column;

-- 2. Count profiles with and without emails
SELECT 
  'Teachers' as profile_type,
  COUNT(*) as total,
  COUNT(email) as with_email,
  COUNT(*) - COUNT(email) as missing_email
FROM teacher_profiles;

SELECT 
  'Students' as profile_type,
  COUNT(*) as total,
  COUNT(email) as with_email,
  COUNT(*) - COUNT(email) as missing_email
FROM student_profiles;

-- 3. Show actual data (replace 'your-email@example.com' with the email you're testing)
SELECT 
  'Teacher matches' as type,
  id, 
  email, 
  full_name
FROM teacher_profiles 
WHERE email = 'your-email@example.com';

SELECT 
  'Student matches' as type,
  id, 
  email, 
  full_name
FROM student_profiles 
WHERE email = 'your-email@example.com';

