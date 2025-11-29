-- SQL to fix profiles with missing or incorrect language settings
-- Run this if you find profiles with NULL or incorrect preferred_language

-- Fix student profiles with NULL preferred_language (set to 'en' as default)
UPDATE student_profiles 
SET preferred_language = 'en' 
WHERE preferred_language IS NULL;

-- Fix teacher profiles with NULL preferred_language (set to 'en' as default)
UPDATE teacher_profiles 
SET preferred_language = 'en' 
WHERE preferred_language IS NULL;

-- Optional: If you know a specific user should be Hebrew, update like this:
-- UPDATE student_profiles 
-- SET preferred_language = 'he' 
-- WHERE email = 'user@example.com';

-- Verify the fix
SELECT 'student' as type, COUNT(*) as total, 
       SUM(CASE WHEN preferred_language = 'en' THEN 1 ELSE 0 END) as english,
       SUM(CASE WHEN preferred_language = 'he' THEN 1 ELSE 0 END) as hebrew,
       SUM(CASE WHEN preferred_language IS NULL THEN 1 ELSE 0 END) as null_lang
FROM student_profiles

UNION ALL

SELECT 'teacher' as type, COUNT(*) as total,
       SUM(CASE WHEN preferred_language = 'en' THEN 1 ELSE 0 END) as english,
       SUM(CASE WHEN preferred_language = 'he' THEN 1 ELSE 0 END) as hebrew,
       SUM(CASE WHEN preferred_language IS NULL THEN 1 ELSE 0 END) as null_lang
FROM teacher_profiles;

