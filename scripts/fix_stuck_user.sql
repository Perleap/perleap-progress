-- Emergency Fix Script for Stuck User
-- Use this to quickly fix a user stuck in the redirecting loop
-- 
-- INSTRUCTIONS:
-- 1. Replace 'STUCK_USER_EMAIL_HERE' with the actual email address
-- 2. Run this in Supabase SQL Editor
-- 3. User should be able to log in afterwards

DO $$
DECLARE
    stuck_user_email TEXT := 'STUCK_USER_EMAIL_HERE';
    user_auth_id UUID;
    teacher_exists BOOLEAN := FALSE;
    student_exists BOOLEAN := FALSE;
    teacher_created TIMESTAMPTZ;
    student_created TIMESTAMPTZ;
    profile_to_keep TEXT;
BEGIN
    -- Step 1: Find the user
    SELECT id INTO user_auth_id 
    FROM auth.users 
    WHERE email = stuck_user_email;

    IF user_auth_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', stuck_user_email;
    END IF;

    RAISE NOTICE '✓ Found user: % (ID: %)', stuck_user_email, user_auth_id;

    -- Step 2: Check what profiles exist
    SELECT 
        EXISTS(SELECT 1 FROM teacher_profiles WHERE user_id = user_auth_id),
        (SELECT created_at FROM teacher_profiles WHERE user_id = user_auth_id LIMIT 1)
    INTO teacher_exists, teacher_created;

    SELECT 
        EXISTS(SELECT 1 FROM student_profiles WHERE user_id = user_auth_id),
        (SELECT created_at FROM student_profiles WHERE user_id = user_auth_id LIMIT 1)
    INTO student_exists, student_created;

    RAISE NOTICE '  Teacher profile: % (created: %)', teacher_exists, teacher_created;
    RAISE NOTICE '  Student profile: % (created: %)', student_exists, student_created;

    -- Step 3: Handle dual profile situation
    IF teacher_exists AND student_exists THEN
        -- User has BOTH profiles - this is the bug!
        RAISE NOTICE '⚠ DUAL PROFILE DETECTED - Cleaning up...';
        
        -- Keep the profile that was created first
        IF teacher_created < student_created THEN
            profile_to_keep := 'teacher';
            RAISE NOTICE '→ Keeping TEACHER profile (older), deleting STUDENT profile';
            DELETE FROM student_profiles WHERE user_id = user_auth_id;
        ELSE
            profile_to_keep := 'student';
            RAISE NOTICE '→ Keeping STUDENT profile (older), deleting TEACHER profile';
            DELETE FROM teacher_profiles WHERE user_id = user_auth_id;
        END IF;

        RAISE NOTICE '✓ Cleanup complete!';
        RAISE NOTICE '⚠ IMPORTANT: Update user metadata role to "%" in Supabase Auth Dashboard', profile_to_keep;
        RAISE NOTICE '   Go to: Authentication > Users > Find user > Edit raw user metadata';
        RAISE NOTICE '   Set: {"role": "%"}', profile_to_keep;
        
    ELSIF teacher_exists THEN
        RAISE NOTICE '✓ Only teacher profile exists - no dual profile issue';
        RAISE NOTICE '  Verify user metadata has role="teacher"';
        
    ELSIF student_exists THEN
        RAISE NOTICE '✓ Only student profile exists - no dual profile issue';
        RAISE NOTICE '  Verify user metadata has role="student"';
        
    ELSE
        RAISE NOTICE '⚠ No profiles found - user needs to complete onboarding';
    END IF;

    -- Step 4: Show current user metadata
    RAISE NOTICE '';
    RAISE NOTICE 'Current user metadata:';
    RAISE NOTICE '%', (SELECT raw_user_meta_data FROM auth.users WHERE id = user_auth_id);

END $$;

-- After running this, check the user's metadata:
-- SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'STUCK_USER_EMAIL_HERE';

-- If metadata role doesn't match the kept profile, update it manually in Supabase dashboard

