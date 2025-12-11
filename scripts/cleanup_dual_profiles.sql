-- Cleanup Script for Dual Profile Bug
-- This script helps identify and clean up users who have both teacher and student profiles
-- Run this with caution in production!

-- ============================================================
-- PART 1: IDENTIFY USERS WITH DUAL PROFILES
-- ============================================================

-- Find all users with both profile types
SELECT 
    tp.user_id,
    tp.email as teacher_email,
    sp.email as student_email,
    tp.full_name as teacher_name,
    sp.full_name as student_name,
    tp.created_at as teacher_created,
    sp.created_at as student_created,
    CASE 
        WHEN tp.created_at < sp.created_at THEN 'teacher'
        ELSE 'student'
    END as first_profile_created
FROM teacher_profiles tp
INNER JOIN student_profiles sp ON tp.user_id = sp.user_id
ORDER BY tp.created_at DESC;

-- ============================================================
-- PART 2: CLEANUP SPECIFIC USER (STUCK USER FROM BUG)
-- ============================================================

-- First, let's see what profiles exist for a specific email
-- REPLACE 'user@example.com' with the actual stuck user's email
DO $$
DECLARE
    stuck_user_email TEXT := 'REPLACE_WITH_ACTUAL_EMAIL';
    user_auth_id UUID;
    teacher_profile_exists BOOLEAN;
    student_profile_exists BOOLEAN;
    teacher_created TIMESTAMPTZ;
    student_created TIMESTAMPTZ;
    keep_profile TEXT;
BEGIN
    -- Get the auth user ID
    SELECT id INTO user_auth_id 
    FROM auth.users 
    WHERE email = stuck_user_email;

    IF user_auth_id IS NULL THEN
        RAISE NOTICE 'No user found with email: %', stuck_user_email;
        RETURN;
    END IF;

    RAISE NOTICE 'Found user ID: %', user_auth_id;

    -- Check both profiles
    SELECT EXISTS(SELECT 1 FROM teacher_profiles WHERE user_id = user_auth_id), created_at
    INTO teacher_profile_exists, teacher_created
    FROM teacher_profiles WHERE user_id = user_auth_id;

    SELECT EXISTS(SELECT 1 FROM student_profiles WHERE user_id = user_auth_id), created_at
    INTO student_profile_exists, student_created
    FROM student_profiles WHERE user_id = user_auth_id;

    RAISE NOTICE 'Teacher profile exists: % (created: %)', teacher_profile_exists, teacher_created;
    RAISE NOTICE 'Student profile exists: % (created: %)', student_profile_exists, student_created;

    -- Determine which profile to keep (the one created first)
    IF teacher_profile_exists AND student_profile_exists THEN
        IF teacher_created < student_created THEN
            keep_profile := 'teacher';
            RAISE NOTICE 'Keeping TEACHER profile (created first), deleting STUDENT profile';
            
            -- Delete student profile
            DELETE FROM student_profiles WHERE user_id = user_auth_id;
            
            -- Update user metadata to ensure it matches
            -- Note: This requires direct auth.users update or using Supabase API
            RAISE NOTICE 'Remember to update user metadata role to "teacher" via Supabase dashboard or API';
        ELSE
            keep_profile := 'student';
            RAISE NOTICE 'Keeping STUDENT profile (created first), deleting TEACHER profile';
            
            -- Delete teacher profile
            DELETE FROM teacher_profiles WHERE user_id = user_auth_id;
            
            -- Update user metadata to ensure it matches
            RAISE NOTICE 'Remember to update user metadata role to "student" via Supabase dashboard or API';
        END IF;
    ELSIF teacher_profile_exists THEN
        RAISE NOTICE 'Only teacher profile exists - no cleanup needed';
    ELSIF student_profile_exists THEN
        RAISE NOTICE 'Only student profile exists - no cleanup needed';
    ELSE
        RAISE NOTICE 'No profiles found for this user';
    END IF;
END $$;

-- ============================================================
-- PART 3: MANUAL CLEANUP QUERIES (USE WITH CAUTION)
-- ============================================================

-- To manually delete a specific user's student profile:
-- DELETE FROM student_profiles WHERE user_id = 'USER_UUID_HERE';

-- To manually delete a specific user's teacher profile:
-- DELETE FROM teacher_profiles WHERE user_id = 'USER_UUID_HERE';

-- To find a user's UUID by email:
-- SELECT id, email, raw_user_meta_data->>'role' as role FROM auth.users WHERE email = 'user@example.com';

-- ============================================================
-- PART 4: VERIFY TRIGGER IS ACTIVE
-- ============================================================

-- Check if the prevention trigger exists and is enabled
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_name IN ('prevent_duplicate_profile_teacher', 'prevent_duplicate_profile_student')
ORDER BY event_object_table;

-- Check if the function exists
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_name = 'check_single_profile_constraint'
AND routine_schema = 'public';

-- ============================================================
-- PART 5: TEST THE TRIGGER (OPTIONAL - WILL FAIL AS EXPECTED)
-- ============================================================

-- This should fail if trigger is working:
-- DO $$
-- DECLARE
--     test_user_id UUID := 'some-existing-user-with-profile';
-- BEGIN
--     -- Try to create opposite profile type (should fail)
--     INSERT INTO student_profiles (user_id, email, full_name)
--     VALUES (test_user_id, 'test@test.com', 'Test User');
-- EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE 'Trigger working correctly: %', SQLERRM;
-- END $$;

