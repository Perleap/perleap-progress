-- PR-SEC-RLS: profile email RPCs, classroom invite RPC, drop anon PII policies.

CREATE OR REPLACE FUNCTION public.profile_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_profiles
    WHERE lower(trim(email)) = lower(trim(p_email))
  ) OR EXISTS (
    SELECT 1
    FROM public.student_profiles
    WHERE lower(trim(email)) = lower(trim(p_email))
  );
$$;

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_profiles_by_email(p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted integer := 0;
  v_count integer;
BEGIN
  IF v_user_id IS NULL OR p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.teacher_profiles
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND user_id IS DISTINCT FROM v_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  DELETE FROM public.student_profiles
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND user_id IS DISTINCT FROM v_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_deleted := v_deleted + v_count;

  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_classroom_by_invite_code(p_invite_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'teacher_id', c.teacher_id
  )
  FROM public.classrooms c
  WHERE c.invite_code = upper(trim(p_invite_code))
    AND c.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.profile_email_exists(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_orphaned_profiles_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_classroom_by_invite_code(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.profile_email_exists(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_profiles_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_classroom_by_invite_code(text) TO anon, authenticated;

DROP POLICY IF EXISTS "teacher_profiles_duplicate_check" ON public.teacher_profiles;
DROP POLICY IF EXISTS "student_profiles_duplicate_check" ON public.student_profiles;
DROP POLICY IF EXISTS "classrooms_invite_check" ON public.classrooms;
