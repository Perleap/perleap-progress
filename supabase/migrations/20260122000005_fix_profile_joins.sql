-- Migration to enable joins with profile tables in PostgREST
-- This adds explicit foreign keys to student_profiles and teacher_profiles
-- to allow ergonomic joins like .select('*, student_profiles(*)')

-- Submissions -> student_profiles
ALTER TABLE public.submissions
DROP CONSTRAINT IF EXISTS submissions_student_id_fkey_profiles,
ADD CONSTRAINT submissions_student_id_fkey_profiles
FOREIGN KEY (student_id) REFERENCES public.student_profiles(user_id) ON DELETE CASCADE;

-- Enrollments -> student_profiles
ALTER TABLE public.enrollments
DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey_profiles,
ADD CONSTRAINT enrollments_student_id_fkey_profiles
FOREIGN KEY (student_id) REFERENCES public.student_profiles(user_id) ON DELETE CASCADE;

-- Classrooms -> teacher_profiles
ALTER TABLE public.classrooms
DROP CONSTRAINT IF EXISTS classrooms_teacher_id_fkey_profiles,
ADD CONSTRAINT classrooms_teacher_id_fkey_profiles
FOREIGN KEY (teacher_id) REFERENCES public.teacher_profiles(user_id) ON DELETE CASCADE;

-- five_d_snapshots -> student_profiles
ALTER TABLE public.five_d_snapshots
DROP CONSTRAINT IF EXISTS five_d_snapshots_user_id_fkey_profiles,
ADD CONSTRAINT five_d_snapshots_user_id_fkey_profiles
FOREIGN KEY (user_id) REFERENCES public.student_profiles(user_id) ON DELETE CASCADE;

-- assignment_feedback -> student_profiles
ALTER TABLE public.assignment_feedback
DROP CONSTRAINT IF EXISTS assignment_feedback_student_id_fkey_profiles,
ADD CONSTRAINT assignment_feedback_student_id_fkey_profiles
FOREIGN KEY (student_id) REFERENCES public.student_profiles(user_id) ON DELETE CASCADE;

-- student_alerts -> student_profiles
ALTER TABLE public.student_alerts
DROP CONSTRAINT IF EXISTS student_alerts_student_id_fkey_profiles,
ADD CONSTRAINT student_alerts_student_id_fkey_profiles
FOREIGN KEY (student_id) REFERENCES public.student_profiles(user_id) ON DELETE CASCADE;

-- teacher_reviews -> teacher_profiles
ALTER TABLE public.teacher_reviews
DROP CONSTRAINT IF EXISTS teacher_reviews_reviewer_id_fkey_profiles,
ADD CONSTRAINT teacher_reviews_reviewer_id_fkey_profiles
FOREIGN KEY (reviewer_id) REFERENCES public.teacher_profiles(user_id) ON DELETE CASCADE;
