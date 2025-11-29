-- Debug script to check profile and auth status
-- Run this in Supabase SQL Editor

-- Replace this with the actual user_id from your error message
-- Current user_id from error: 7fb228b6-7539-4991-a76b-7eabeeb67f00
DO $$
DECLARE
    target_user_id UUID := '7fb228b6-7539-4991-a76b-7eabeeb67f00'; -- CHANGE THIS
BEGIN
    RAISE NOTICE '=== CHECKING USER: % ===', target_user_id;
END $$;

-- 1. Check if auth user exists
SELECT 
    'AUTH USER' as check_type,
    id,
    email,
    created_at,
    raw_user_meta_data->>'role' as intended_role
FROM auth.users
WHERE id = '7fb228b6-7539-4991-a76b-7eabeeb67f00'; -- CHANGE THIS

-- 2. Check if student profile exists
SELECT 
    'STUDENT PROFILE' as check_type,
    user_id,
    email,
    full_name,
    preferred_language,
    created_at
FROM student_profiles
WHERE user_id = '7fb228b6-7539-4991-a76b-7eabeeb67f00'; -- CHANGE THIS

-- 3. Check if teacher profile exists
SELECT 
    'TEACHER PROFILE' as check_type,
    user_id,
    email,
    full_name,
    preferred_language,
    created_at
FROM teacher_profiles
WHERE user_id = '7fb228b6-7539-4991-a76b-7eabeeb67f00'; -- CHANGE THIS

-- 4. Check for orphaned profiles with same email
SELECT 
    'ORPHANED PROFILES' as check_type,
    sp.user_id as profile_user_id,
    sp.email,
    sp.created_at,
    CASE 
        WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = sp.user_id) THEN 'Auth user exists'
        ELSE 'ORPHANED - auth user deleted'
    END as status
FROM student_profiles sp
WHERE sp.email IN (
    SELECT email FROM auth.users WHERE id = '7fb228b6-7539-4991-a76b-7eabeeb67f00' -- CHANGE THIS
);

-- 5. Test RLS policy (simulating the user's request)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO '7fb228b6-7539-4991-a76b-7eabeeb67f00'; -- CHANGE THIS

SELECT 
    'RLS TEST' as check_type,
    user_id,
    email,
    full_name
FROM student_profiles
WHERE user_id = '7fb228b6-7539-4991-a76b-7eabeeb67f00'; -- CHANGE THIS

RESET role;

