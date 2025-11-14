-- Add 'project' to assignment_type enum
-- The AI generates 'project' type assignments, so we need to support it

ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'project';

-- Add comment to document the types
COMMENT ON TYPE public.assignment_type IS 'Assignment types: text_essay, quiz_mcq, creative_task, discussion_prompt, multimedia, project';

