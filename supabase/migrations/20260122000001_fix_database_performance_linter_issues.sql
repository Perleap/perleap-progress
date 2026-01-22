-- Performance Optimization Migration: Fix Unindexed Foreign Keys and Remove Unused Indexes
-- Based on Supabase Database Linter reports

-- 1. Create covering indexes for unindexed foreign keys
-- These will improve join performance and constraint checking

CREATE INDEX IF NOT EXISTS idx_ai_lesson_plans_teacher_id 
  ON public.ai_lesson_plans(teacher_id);

CREATE INDEX IF NOT EXISTS idx_assignment_conversations_submission_id 
  ON public.assignment_conversations(submission_id);

CREATE INDEX IF NOT EXISTS idx_assignment_feedback_submission_id 
  ON public.assignment_feedback(submission_id);

CREATE INDEX IF NOT EXISTS idx_assignments_classroom_id 
  ON public.assignments(classroom_id);

CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id 
  ON public.classrooms(teacher_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_id 
  ON public.enrollments(student_id);

CREATE INDEX IF NOT EXISTS idx_student_alerts_acknowledged_by 
  ON public.student_alerts(acknowledged_by);

CREATE INDEX IF NOT EXISTS idx_submissions_student_id 
  ON public.submissions(student_id);

CREATE INDEX IF NOT EXISTS idx_teacher_reviews_evaluation_id 
  ON public.teacher_reviews(evaluation_id);

CREATE INDEX IF NOT EXISTS idx_teacher_reviews_reviewer_id 
  ON public.teacher_reviews(reviewer_id);


-- 2. Drop unused indexes
-- These indexes were identified as never used and are safe to remove to save storage and reduce write overhead

DROP INDEX IF EXISTS public.idx_student_alerts_alert_level;
DROP INDEX IF EXISTS public.idx_student_alerts_is_acknowledged;
DROP INDEX IF EXISTS public.idx_student_alerts_created_at;
DROP INDEX IF EXISTS public.idx_ai_prompts_active;
DROP INDEX IF EXISTS public.idx_five_d_snapshots_has_explanations;
DROP INDEX IF EXISTS public.idx_ai_prompts_language;
DROP INDEX IF EXISTS public.idx_ai_prompts_key_language;
DROP INDEX IF EXISTS public.idx_assignments_materials;
DROP INDEX IF EXISTS public.idx_assignment_chat_history_created_at;
DROP INDEX IF EXISTS public.idx_submissions_status;
DROP INDEX IF EXISTS public.idx_classrooms_domains;
DROP INDEX IF EXISTS public.idx_classrooms_materials;
