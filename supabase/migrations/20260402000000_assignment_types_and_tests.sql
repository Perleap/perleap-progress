-- Expand assignment_type enum with new values
-- These must run in their own transaction before the new values can be used
ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'questions';
ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'test';
ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'presentation';
ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'langchain';

COMMENT ON TYPE public.assignment_type IS 'Assignment types: text_essay, questions, test, project, presentation, langchain (legacy: quiz_mcq, creative_task, discussion_prompt, multimedia)';
