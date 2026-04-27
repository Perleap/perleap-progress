-- Unenroll via RPC so student leave works even if enrollments UPDATE RLS (WITH CHECK) is misaligned on a project.
-- The function enforces: only the enrollment row for auth.uid() + classroom may be updated.

CREATE OR REPLACE FUNCTION public.student_unenroll_from_classroom(p_classroom_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  n int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.enrollments
  SET
    active = false,
    deleted_at = now()
  WHERE classroom_id = p_classroom_id
    AND student_id = v_uid
    AND active = true;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.student_unenroll_from_classroom(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_unenroll_from_classroom(uuid) TO authenticated;
