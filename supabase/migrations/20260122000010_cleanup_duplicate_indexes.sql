-- Fix duplicate indexes reported by database linter
-- This migration drops redundant indexes that were identified as duplicates.

-- 1. assignment_feedback table
-- idx_assignment_feedback_assignment_id is identical to idx_feedback_assignment
-- idx_assignment_feedback_student_id is identical to idx_feedback_student
DROP INDEX IF EXISTS public.idx_assignment_feedback_assignment_id;
DROP INDEX IF EXISTS public.idx_assignment_feedback_student_id;

-- 2. hard_skill_assessments table
-- idx_hard_skill_assessments_assignment_id is identical to idx_hard_skill_assessments_assignment
-- idx_hard_skill_assessments_student_id is identical to idx_hard_skill_assessments_student
-- idx_hard_skill_assessments_submission_id is identical to idx_hard_skill_assessments_submission
DROP INDEX IF EXISTS public.idx_hard_skill_assessments_assignment_id;
DROP INDEX IF EXISTS public.idx_hard_skill_assessments_student_id;
DROP INDEX IF EXISTS public.idx_hard_skill_assessments_submission_id;
