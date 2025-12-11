-- Verification Script for Dual Profile Prevention System
-- Run this to ensure all protections are in place

-- ============================================================
-- CHECK 1: Verify the prevention function exists
-- ============================================================
SELECT 
    'Function Check' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ PASS - Function exists'
        ELSE '✗ FAIL - Function missing'
    END as status,
    COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'check_single_profile_constraint';

-- ============================================================
-- CHECK 2: Verify triggers are active on both tables
-- ============================================================
SELECT 
    'Trigger Check' as check_type,
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation as event_type,
    CASE 
        WHEN trigger_name IN ('prevent_duplicate_profile_teacher', 'prevent_duplicate_profile_student')
        THEN '✓ PASS - Trigger active'
        ELSE '? Unknown trigger'
    END as status
FROM information_schema.triggers
WHERE trigger_name IN ('prevent_duplicate_profile_teacher', 'prevent_duplicate_profile_student')
ORDER BY event_object_table;

-- ============================================================
-- CHECK 3: Count existing dual profiles (should be 0 after cleanup)
-- ============================================================
SELECT 
    'Dual Profile Check' as check_type,
    COUNT(*) as dual_profile_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✓ PASS - No dual profiles'
        ELSE '⚠ WARNING - Dual profiles exist'
    END as status
FROM teacher_profiles tp
INNER JOIN student_profiles sp ON tp.user_id = sp.user_id;

-- ============================================================
-- CHECK 4: Verify UNIQUE constraints on user_id
-- ============================================================
SELECT 
    'Unique Constraint Check' as check_type,
    tc.table_name,
    kcu.column_name,
    '✓ PASS - UNIQUE constraint exists' as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN ('teacher_profiles', 'student_profiles')
  AND kcu.column_name = 'user_id'
ORDER BY tc.table_name;

-- ============================================================
-- CHECK 5: List any dual profiles that exist (for cleanup)
-- ============================================================
SELECT 
    'Existing Dual Profiles' as check_type,
    tp.user_id,
    tp.email as teacher_email,
    sp.email as student_email,
    tp.created_at as teacher_created,
    sp.created_at as student_created
FROM teacher_profiles tp
INNER JOIN student_profiles sp ON tp.user_id = sp.user_id;

-- ============================================================
-- SUMMARY REPORT
-- ============================================================
DO $$
DECLARE
    function_exists BOOLEAN;
    teacher_trigger_exists BOOLEAN;
    student_trigger_exists BOOLEAN;
    dual_profile_count INT;
    all_checks_pass BOOLEAN := TRUE;
BEGIN
    -- Check function
    SELECT EXISTS(
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_name = 'check_single_profile_constraint'
    ) INTO function_exists;

    -- Check triggers
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'prevent_duplicate_profile_teacher'
    ) INTO teacher_trigger_exists;

    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_name = 'prevent_duplicate_profile_student'
    ) INTO student_trigger_exists;

    -- Count dual profiles
    SELECT COUNT(*) INTO dual_profile_count
    FROM teacher_profiles tp
    INNER JOIN student_profiles sp ON tp.user_id = sp.user_id;

    -- Generate report
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE 'DUAL PROFILE PREVENTION VERIFICATION REPORT';
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
    
    RAISE NOTICE '1. Prevention Function:';
    IF function_exists THEN
        RAISE NOTICE '   ✓ check_single_profile_constraint() exists';
    ELSE
        RAISE NOTICE '   ✗ Function MISSING - Run migration 20251117193347';
        all_checks_pass := FALSE;
    END IF;
    RAISE NOTICE '';

    RAISE NOTICE '2. Trigger on teacher_profiles:';
    IF teacher_trigger_exists THEN
        RAISE NOTICE '   ✓ prevent_duplicate_profile_teacher is active';
    ELSE
        RAISE NOTICE '   ✗ Trigger MISSING - Run migration 20251117193347';
        all_checks_pass := FALSE;
    END IF;
    RAISE NOTICE '';

    RAISE NOTICE '3. Trigger on student_profiles:';
    IF student_trigger_exists THEN
        RAISE NOTICE '   ✓ prevent_duplicate_profile_student is active';
    ELSE
        RAISE NOTICE '   ✗ Trigger MISSING - Run migration 20251117193347';
        all_checks_pass := FALSE;
    END IF;
    RAISE NOTICE '';

    RAISE NOTICE '4. Existing Dual Profiles:';
    IF dual_profile_count = 0 THEN
        RAISE NOTICE '   ✓ No dual profiles found';
    ELSE
        RAISE NOTICE '   ⚠ WARNING: % user(s) with dual profiles', dual_profile_count;
        RAISE NOTICE '   → Run scripts/fix_stuck_user.sql to clean up';
        all_checks_pass := FALSE;
    END IF;
    RAISE NOTICE '';

    RAISE NOTICE '═══════════════════════════════════════════════════════';
    IF all_checks_pass THEN
        RAISE NOTICE 'STATUS: ✓ ALL CHECKS PASSED';
        RAISE NOTICE 'The dual profile prevention system is active and working.';
    ELSE
        RAISE NOTICE 'STATUS: ✗ ISSUES FOUND';
        RAISE NOTICE 'Please address the issues listed above.';
    END IF;
    RAISE NOTICE '═══════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

