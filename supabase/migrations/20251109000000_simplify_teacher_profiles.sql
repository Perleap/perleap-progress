-- Remove unused columns from teacher_profiles table
-- This migration simplifies the onboarding from 33 questions to 9 questions

ALTER TABLE public.teacher_profiles
DROP COLUMN IF EXISTS student_types,
DROP COLUMN IF EXISTS specialization_1,
DROP COLUMN IF EXISTS specialization_2,
DROP COLUMN IF EXISTS workplace,
DROP COLUMN IF EXISTS typical_student_count,
DROP COLUMN IF EXISTS student_age_range,
DROP COLUMN IF EXISTS student_objectives,
DROP COLUMN IF EXISTS lesson_start_approach,
DROP COLUMN IF EXISTS mistake_response,
DROP COLUMN IF EXISTS encouragement_phrases,
DROP COLUMN IF EXISTS phrases_to_avoid,
DROP COLUMN IF EXISTS lesson_structure,
DROP COLUMN IF EXISTS discussion_timing,
DROP COLUMN IF EXISTS question_types,
DROP COLUMN IF EXISTS lesson_ending,
DROP COLUMN IF EXISTS educational_values,
DROP COLUMN IF EXISTS skills_to_develop,
DROP COLUMN IF EXISTS strongest_qualities,
DROP COLUMN IF EXISTS difficult_concept_example,
DROP COLUMN IF EXISTS hard_work_feedback_example,
DROP COLUMN IF EXISTS misunderstanding_feedback_example,
DROP COLUMN IF EXISTS disruptive_student_response,
DROP COLUMN IF EXISTS no_understanding_response,
DROP COLUMN IF EXISTS challenging_question_response;

-- Retained columns:
-- - id, user_id, created_at, updated_at (system)
-- - full_name, phone_number, avatar_url (basic info)
-- - subjects, years_experience, student_education_level (essential profile)
-- - teaching_goals (repurposed: teaching goals)
-- - style_notes (repurposed: teaching style description)
-- - teaching_examples (repurposed: teaching example)
-- - sample_explanation (repurposed: additional notes)

