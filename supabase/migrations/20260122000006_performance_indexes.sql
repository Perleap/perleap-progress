-- Performance Optimization: Add missing indexes for frequently queried columns
-- This addresses slow queries identified in database performance reports

-- 1. Submissions
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id_status ON public.submissions(student_id, status);

-- 2. Enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_classroom_id ON public.enrollments(classroom_id);

-- 3. Five D Snapshots
CREATE INDEX IF NOT EXISTS idx_five_d_snapshots_user_id ON public.five_d_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_five_d_snapshots_submission_id ON public.five_d_snapshots(submission_id);
CREATE INDEX IF NOT EXISTS idx_five_d_snapshots_classroom_id ON public.five_d_snapshots(classroom_id);

-- 4. Assignment Feedback
CREATE INDEX IF NOT EXISTS idx_assignment_feedback_student_id ON public.assignment_feedback(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_feedback_assignment_id ON public.assignment_feedback(assignment_id);

-- 5. Hard Skill Assessments
CREATE INDEX IF NOT EXISTS idx_hard_skill_assessments_submission_id ON public.hard_skill_assessments(submission_id);
CREATE INDEX IF NOT EXISTS idx_hard_skill_assessments_student_id ON public.hard_skill_assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_hard_skill_assessments_assignment_id ON public.hard_skill_assessments(assignment_id);

-- 6. Notifications (very frequent queries)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON public.notifications(user_id, is_read);

-- 7. Activity Events
CREATE INDEX IF NOT EXISTS idx_activity_events_teacher_id ON public.activity_events(teacher_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_entity_id ON public.activity_events(entity_id);

-- 8. Add index to preferred_language for profile tables
CREATE INDEX IF NOT EXISTS idx_student_profiles_preferred_language ON public.student_profiles(preferred_language);
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_preferred_language ON public.teacher_profiles(preferred_language);
