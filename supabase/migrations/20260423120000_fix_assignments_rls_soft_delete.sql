-- Soft-delete PATCH failed with 403: assignments_update_teacher used EXISTS(...) over
-- public.classrooms under the invoker, so classroom RLS could block the subquery.
-- Use check_owns_classroom (SECURITY DEFINER) like other policies.
-- Teachers must also SELECT inactive assignments they own (active = false after soft-delete).

DROP POLICY IF EXISTS "assignments_select" ON public.assignments;
CREATE POLICY "assignments_select" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    public.check_owns_classroom((select auth.uid()), classroom_id)
    OR
    (
      active = true
      AND status = 'published'
      AND public.check_is_enrolled((select auth.uid()), classroom_id)
    )
  );

DROP POLICY IF EXISTS "assignments_insert_teacher" ON public.assignments;
CREATE POLICY "assignments_insert_teacher" ON public.assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_owns_classroom((select auth.uid()), assignments.classroom_id)
  );

DROP POLICY IF EXISTS "assignments_update_teacher" ON public.assignments;
CREATE POLICY "assignments_update_teacher" ON public.assignments
  FOR UPDATE TO authenticated
  USING (
    public.check_owns_classroom((select auth.uid()), assignments.classroom_id)
  )
  WITH CHECK (
    public.check_owns_classroom((select auth.uid()), assignments.classroom_id)
  );
