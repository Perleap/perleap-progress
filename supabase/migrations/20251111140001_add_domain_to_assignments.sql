-- Add hard_skill_domain field to assignments table
-- Stores the Subject Area category for hard skill assessments (e.g., "Algebra", "Geometry", "Calculus")

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS hard_skill_domain TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN public.assignments.hard_skill_domain IS 'Subject Area category for hard skill assessments (e.g., Algebra, Geometry, Calculus)';

