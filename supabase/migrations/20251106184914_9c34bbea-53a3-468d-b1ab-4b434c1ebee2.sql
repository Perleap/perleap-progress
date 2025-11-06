-- Add additional fields to teacher_profiles
ALTER TABLE public.teacher_profiles
ADD COLUMN full_name TEXT,
ADD COLUMN phone_number TEXT,
ADD COLUMN specialization_1 TEXT,
ADD COLUMN specialization_2 TEXT,
ADD COLUMN workplace TEXT,
ADD COLUMN typical_student_count TEXT,
ADD COLUMN student_age_range TEXT,
ADD COLUMN student_education_level TEXT,
ADD COLUMN student_objectives TEXT,
ADD COLUMN lesson_start_approach TEXT,
ADD COLUMN mistake_response TEXT,
ADD COLUMN encouragement_phrases TEXT,
ADD COLUMN phrases_to_avoid TEXT,
ADD COLUMN teaching_examples TEXT,
ADD COLUMN sample_explanation TEXT,
ADD COLUMN lesson_structure TEXT,
ADD COLUMN discussion_timing TEXT,
ADD COLUMN question_types TEXT,
ADD COLUMN lesson_ending TEXT,
ADD COLUMN educational_values TEXT,
ADD COLUMN skills_to_develop TEXT,
ADD COLUMN strongest_qualities TEXT,
ADD COLUMN difficult_concept_example TEXT,
ADD COLUMN hard_work_feedback_example TEXT,
ADD COLUMN misunderstanding_feedback_example TEXT,
ADD COLUMN disruptive_student_response TEXT,
ADD COLUMN no_understanding_response TEXT,
ADD COLUMN challenging_question_response TEXT;

-- Add additional fields to student_profiles
ALTER TABLE public.student_profiles
ADD COLUMN full_name TEXT,
ADD COLUMN learning_methods TEXT,
ADD COLUMN solo_vs_group TEXT,
ADD COLUMN scheduled_vs_flexible TEXT,
ADD COLUMN motivation_factors TEXT,
ADD COLUMN help_preferences TEXT,
ADD COLUMN teacher_preferences TEXT,
ADD COLUMN feedback_preferences TEXT,
ADD COLUMN learning_goal TEXT,
ADD COLUMN special_needs TEXT,
ADD COLUMN additional_notes TEXT;

-- Add additional fields to classrooms for course details
ALTER TABLE public.classrooms
ADD COLUMN course_title TEXT,
ADD COLUMN course_duration TEXT,
ADD COLUMN course_outline TEXT,
ADD COLUMN resources TEXT,
ADD COLUMN learning_outcomes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN key_challenges JSONB DEFAULT '[]'::jsonb;