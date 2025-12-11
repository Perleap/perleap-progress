-- Admin Utility for Managing Dual Profile Issues
-- This script provides functions for admins to manage and fix dual profile situations
-- Use with caution - these functions have direct database impact

-- ============================================================
-- FUNCTION 1: List all users with dual profiles
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_list_dual_profiles()
RETURNS TABLE (
    user_id UUID,
    user_email TEXT,
    teacher_email TEXT,
    student_email TEXT,
    teacher_name TEXT,
    student_name TEXT,
    teacher_created TIMESTAMPTZ,
    student_created TIMESTAMPTZ,
    older_profile TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tp.user_id,
        au.email as user_email,
        tp.email as teacher_email,
        sp.email as student_email,
        tp.full_name as teacher_name,
        sp.full_name as student_name,
        tp.created_at as teacher_created,
        sp.created_at as student_created,
        CASE 
            WHEN tp.created_at < sp.created_at THEN 'teacher'
            ELSE 'student'
        END as older_profile
    FROM teacher_profiles tp
    INNER JOIN student_profiles sp ON tp.user_id = sp.user_id
    LEFT JOIN auth.users au ON au.id = tp.user_id
    ORDER BY tp.created_at DESC;
END;
$$;

-- ============================================================
-- FUNCTION 2: Fix a specific user's dual profile
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_fix_dual_profile(
    target_user_id UUID,
    keep_profile_type TEXT DEFAULT 'older'
)
RETURNS TABLE (
    status TEXT,
    message TEXT,
    kept_profile TEXT,
    deleted_profile TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    teacher_exists BOOLEAN;
    student_exists BOOLEAN;
    teacher_created TIMESTAMPTZ;
    student_created TIMESTAMPTZ;
    profile_to_keep TEXT;
    profile_deleted TEXT;
BEGIN
    -- Check if both profiles exist
    SELECT 
        EXISTS(SELECT 1 FROM teacher_profiles WHERE user_id = target_user_id),
        (SELECT created_at FROM teacher_profiles WHERE user_id = target_user_id)
    INTO teacher_exists, teacher_created;

    SELECT 
        EXISTS(SELECT 1 FROM student_profiles WHERE user_id = target_user_id),
        (SELECT created_at FROM student_profiles WHERE user_id = target_user_id)
    INTO student_exists, student_created;

    -- Validate dual profile exists
    IF NOT (teacher_exists AND student_exists) THEN
        RETURN QUERY SELECT 
            'error'::TEXT,
            'User does not have dual profiles'::TEXT,
            NULL::TEXT,
            NULL::TEXT;
        RETURN;
    END IF;

    -- Determine which profile to keep
    IF keep_profile_type = 'teacher' THEN
        profile_to_keep := 'teacher';
    ELSIF keep_profile_type = 'student' THEN
        profile_to_keep := 'student';
    ELSIF keep_profile_type = 'older' THEN
        profile_to_keep := CASE 
            WHEN teacher_created < student_created THEN 'teacher'
            ELSE 'student'
        END;
    ELSIF keep_profile_type = 'newer' THEN
        profile_to_keep := CASE 
            WHEN teacher_created > student_created THEN 'teacher'
            ELSE 'student'
        END;
    ELSE
        RETURN QUERY SELECT 
            'error'::TEXT,
            'Invalid keep_profile_type. Use: teacher, student, older, or newer'::TEXT,
            NULL::TEXT,
            NULL::TEXT;
        RETURN;
    END IF;

    -- Delete the profile we're not keeping
    IF profile_to_keep = 'teacher' THEN
        DELETE FROM student_profiles WHERE user_id = target_user_id;
        profile_deleted := 'student';
    ELSE
        DELETE FROM teacher_profiles WHERE user_id = target_user_id;
        profile_deleted := 'teacher';
    END IF;

    RETURN QUERY SELECT 
        'success'::TEXT,
        format('Dual profile fixed. Kept %s profile, deleted %s profile.', profile_to_keep, profile_deleted)::TEXT,
        profile_to_keep::TEXT,
        profile_deleted::TEXT;
END;
$$;

-- ============================================================
-- FUNCTION 3: Get user profile status
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_get_user_profile_status(
    user_email_or_id TEXT
)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    metadata_role TEXT,
    has_teacher_profile BOOLEAN,
    has_student_profile BOOLEAN,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
    user_email TEXT;
    user_role TEXT;
    teacher_exists BOOLEAN;
    student_exists BOOLEAN;
    status_msg TEXT;
BEGIN
    -- Try to parse as UUID first, otherwise treat as email
    BEGIN
        target_user_id := user_email_or_id::UUID;
        SELECT au.email, au.raw_user_meta_data->>'role'
        INTO user_email, user_role
        FROM auth.users au
        WHERE au.id = target_user_id;
    EXCEPTION WHEN invalid_text_representation THEN
        -- Not a UUID, treat as email
        SELECT au.id, au.email, au.raw_user_meta_data->>'role'
        INTO target_user_id, user_email, user_role
        FROM auth.users au
        WHERE au.email = user_email_or_id;
    END;

    IF target_user_id IS NULL THEN
        RETURN QUERY SELECT 
            NULL::UUID,
            NULL::TEXT,
            NULL::TEXT,
            FALSE::BOOLEAN,
            FALSE::BOOLEAN,
            'User not found'::TEXT;
        RETURN;
    END IF;

    -- Check profile existence
    SELECT EXISTS(SELECT 1 FROM teacher_profiles WHERE teacher_profiles.user_id = target_user_id)
    INTO teacher_exists;

    SELECT EXISTS(SELECT 1 FROM student_profiles WHERE student_profiles.user_id = target_user_id)
    INTO student_exists;

    -- Determine status
    IF teacher_exists AND student_exists THEN
        status_msg := 'DUAL PROFILE - NEEDS CLEANUP';
    ELSIF teacher_exists AND user_role = 'teacher' THEN
        status_msg := 'OK - Teacher profile matches metadata';
    ELSIF student_exists AND user_role = 'student' THEN
        status_msg := 'OK - Student profile matches metadata';
    ELSIF teacher_exists AND user_role != 'teacher' THEN
        status_msg := 'WARNING - Teacher profile but metadata says ' || COALESCE(user_role, 'null');
    ELSIF student_exists AND user_role != 'student' THEN
        status_msg := 'WARNING - Student profile but metadata says ' || COALESCE(user_role, 'null');
    ELSIF NOT teacher_exists AND NOT student_exists THEN
        status_msg := 'No profile - needs onboarding';
    ELSE
        status_msg := 'Unknown status';
    END IF;

    RETURN QUERY SELECT 
        target_user_id,
        user_email,
        user_role,
        teacher_exists,
        student_exists,
        status_msg;
END;
$$;

-- ============================================================
-- USAGE EXAMPLES
-- ============================================================

-- List all users with dual profiles:
-- SELECT * FROM public.admin_list_dual_profiles();

-- Check a specific user's status by email:
-- SELECT * FROM public.admin_get_user_profile_status('user@example.com');

-- Check a specific user's status by UUID:
-- SELECT * FROM public.admin_get_user_profile_status('550e8400-e29b-41d4-a716-446655440000');

-- Fix a user's dual profile (keep older profile):
-- SELECT * FROM public.admin_fix_dual_profile('550e8400-e29b-41d4-a716-446655440000', 'older');

-- Fix a user's dual profile (keep teacher profile):
-- SELECT * FROM public.admin_fix_dual_profile('550e8400-e29b-41d4-a716-446655440000', 'teacher');

-- Fix a user's dual profile (keep student profile):
-- SELECT * FROM public.admin_fix_dual_profile('550e8400-e29b-41d4-a716-446655440000', 'student');

-- ============================================================
-- GRANTS (Optional - uncomment if you have specific roles)
-- ============================================================

-- GRANT EXECUTE ON FUNCTION public.admin_list_dual_profiles() TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.admin_fix_dual_profile(UUID, TEXT) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.admin_get_user_profile_status(TEXT) TO authenticated;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION public.admin_list_dual_profiles() IS 
'Lists all users who have both teacher and student profiles (dual profile bug)';

COMMENT ON FUNCTION public.admin_fix_dual_profile(UUID, TEXT) IS 
'Fixes a user with dual profiles by keeping one and deleting the other. 
Parameters:
- target_user_id: UUID of the user to fix
- keep_profile_type: Which profile to keep (older, newer, teacher, or student)';

COMMENT ON FUNCTION public.admin_get_user_profile_status(TEXT) IS 
'Gets the profile status of a user by email or UUID.
Returns user info, metadata role, and whether they have teacher/student profiles.';

