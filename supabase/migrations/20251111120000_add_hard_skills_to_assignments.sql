-- Add hard_skills column to assignments table (stored as JSON array)
ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS hard_skills TEXT;

-- Update existing assignments to have empty array as default
UPDATE public.assignments
SET hard_skills = '[]'
WHERE hard_skills IS NULL;

-- Add comment to explain the field stores JSON
COMMENT ON COLUMN public.assignments.hard_skills IS 'JSON array of hard skills strings for this assignment';

