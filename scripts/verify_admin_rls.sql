-- Manual RLS checks for admin (run as an authenticated session in the SQL Editor is not possible
-- for auth.uid()—use the app or create a test JWT). Suggested checks:
--
-- 1) As service role: confirm app_admins and is_app_admin:
--    SELECT public.is_app_admin('YOUR_ADMIN_USER_ID'::uuid);
--
-- 2) In the app, sign in as admin and confirm:
--    - Teacher dashboard lists classrooms from multiple teacher_id values.
--    - Opening /teacher/classroom/:id works for another teacher's class.
--
-- 3) As a non-admin teacher, the same queries must not return other teachers' rows (RLS).

SELECT 1 AS note;
