-- Soft-delete PATCH failed with 42501: UPDATE ... RETURNING must satisfy SELECT RLS on the new row.
-- classrooms_select required active = true for everyone, so after setting active = false the row
-- was invisible and PostgREST/RLS rejected the operation (same pattern as assignments soft-delete fix).
-- Teachers may SELECT their own classrooms regardless of active; students and invite discovery
-- remain limited to active rows only.

DROP POLICY IF EXISTS "classrooms_select" ON public.classrooms;
CREATE POLICY "classrooms_select" ON public.classrooms
  FOR SELECT TO authenticated
  USING (
    teacher_id = (select auth.uid())
    OR (
      active = true
      AND (
        public.check_is_enrolled((select auth.uid()), id)
        OR invite_code IS NOT NULL
      )
    )
  );
