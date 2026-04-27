-- Student "leave course" updates enrollments to active = false, deleted_at set.
-- Runtime: 42501 "new row violates row-level security policy" — WITH CHECK on UPDATE
-- must allow that terminal row (see enrollments_active_deleted_at_chk), same idea as
-- supabase/migrations/20260423120000_fix_assignments_rls_soft_delete.sql

DROP POLICY IF EXISTS "enrollments_update_student" ON public.enrollments;
CREATE POLICY "enrollments_update_student" ON public.enrollments
  FOR UPDATE TO authenticated
  USING (
    student_id = (select auth.uid())
    AND active = true
  )
  WITH CHECK (
    student_id = (select auth.uid())
    AND (
      (active = true AND deleted_at IS NULL)
      OR (active = false AND deleted_at IS NOT NULL)
    )
  );
