-- Migration to enable joins between assignments and student_profiles
-- This allows ergonomic joins like .select('*, student_profiles(*)')

ALTER TABLE public.assignments
DROP CONSTRAINT IF EXISTS assignments_assigned_student_id_fkey_profiles,
ADD CONSTRAINT assignments_assigned_student_id_fkey_profiles
FOREIGN KEY (assigned_student_id) REFERENCES public.student_profiles(user_id) ON DELETE CASCADE;
