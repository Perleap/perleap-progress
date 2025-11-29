-- Diagnostic SQL to check profile and language status
-- Run this in your Supabase SQL Editor after attempting to register

-- 1. Check if student profiles exist and their language settings
SELECT 
    sp.user_id,
    sp.email,
    sp.full_name,
    sp.preferred_language,
    sp.created_at,
    au.email as auth_email,
    au.created_at as auth_created
FROM student_profiles sp
LEFT JOIN auth.users au ON sp.user_id = au.id
ORDER BY sp.created_at DESC
LIMIT 10;

-- 2. Check if teacher profiles exist and their language settings
SELECT 
    tp.user_id,
    tp.email,
    tp.full_name,
    tp.preferred_language,
    tp.created_at,
    au.email as auth_email,
    au.created_at as auth_created
FROM teacher_profiles tp
LEFT JOIN auth.users au ON tp.user_id = au.id
ORDER BY tp.created_at DESC
LIMIT 10;

-- 3. Check for orphaned auth users (users without profiles)
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.raw_user_meta_data->>'role' as intended_role,
    CASE 
        WHEN EXISTS (SELECT 1 FROM student_profiles WHERE user_id = au.id) THEN 'student'
        WHEN EXISTS (SELECT 1 FROM teacher_profiles WHERE user_id = au.id) THEN 'teacher'
        ELSE 'NO PROFILE'
    END as actual_role
FROM auth.users au
WHERE au.created_at > NOW() - INTERVAL '1 day'
ORDER BY au.created_at DESC
LIMIT 20;

-- 4. Check for profile language mismatches
SELECT 
    'student' as profile_type,
    user_id,
    email,
    preferred_language,
    CASE 
        WHEN preferred_language IS NULL THEN 'NULL'
        WHEN preferred_language = 'en' THEN 'English'
        WHEN preferred_language = 'he' THEN 'Hebrew'
        ELSE preferred_language
    END as language_label
FROM student_profiles
WHERE preferred_language IS NULL OR preferred_language NOT IN ('en', 'he')

UNION ALL

SELECT 
    'teacher' as profile_type,
    user_id,
    email,
    preferred_language,
    CASE 
        WHEN preferred_language IS NULL THEN 'NULL'
        WHEN preferred_language = 'en' THEN 'English'
        WHEN preferred_language = 'he' THEN 'Hebrew'
        ELSE preferred_language
    END as language_label
FROM teacher_profiles
WHERE preferred_language IS NULL OR preferred_language NOT IN ('en', 'he');

