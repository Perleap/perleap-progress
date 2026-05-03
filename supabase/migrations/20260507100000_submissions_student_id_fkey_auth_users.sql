-- Teacher preview rows use student_id = teacher's auth user id; FK to student_profiles only rejects those users.
-- Restore reference to auth.users (matches pre–20260122000005 schema) while keeping PostgREST joins via manual selects.

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_student_id_fkey_profiles;

ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_student_id_fkey_auth_users
  FOREIGN KEY (student_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT submissions_student_id_fkey_auth_users ON public.submissions IS
  'Owning user: enrolled student, or teacher when is_teacher_attempt is true.';

NOTIFY pgrst, 'reload schema';
