-- Clean up orphaned profile for a specific email
-- Use this when a user deleted their account but the profile remained

-- Replace 'user@example.com' with the actual email address
DO $$
DECLARE
    target_email TEXT := 'user@example.com'; -- CHANGE THIS
    orphaned_profile_user_id UUID;
BEGIN
    -- Find the orphaned student profile
    SELECT user_id INTO orphaned_profile_user_id
    FROM student_profiles
    WHERE email = target_email;

    IF orphaned_profile_user_id IS NOT NULL THEN
        -- Check if this user_id still exists in auth.users
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = orphaned_profile_user_id) THEN
            RAISE NOTICE 'Found orphaned student profile for email: %. Deleting...', target_email;
            DELETE FROM student_profiles WHERE email = target_email;
            RAISE NOTICE 'Orphaned student profile deleted successfully';
        ELSE
            RAISE NOTICE 'Profile exists but user still exists in auth.users. Not orphaned.';
        END IF;
    END IF;

    -- Find the orphaned teacher profile
    SELECT user_id INTO orphaned_profile_user_id
    FROM teacher_profiles
    WHERE email = target_email;

    IF orphaned_profile_user_id IS NOT NULL THEN
        -- Check if this user_id still exists in auth.users
        IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = orphaned_profile_user_id) THEN
            RAISE NOTICE 'Found orphaned teacher profile for email: %. Deleting...', target_email;
            DELETE FROM teacher_profiles WHERE email = target_email;
            RAISE NOTICE 'Orphaned teacher profile deleted successfully';
        ELSE
            RAISE NOTICE 'Profile exists but user still exists in auth.users. Not orphaned.';
        END IF;
    END IF;
END $$;

-- Verify cleanup
SELECT 'student_profiles' as table_name, user_id, email, created_at
FROM student_profiles
WHERE email = 'user@example.com' -- CHANGE THIS

UNION ALL

SELECT 'teacher_profiles' as table_name, user_id, email, created_at
FROM teacher_profiles
WHERE email = 'user@example.com'; -- CHANGE THIS

