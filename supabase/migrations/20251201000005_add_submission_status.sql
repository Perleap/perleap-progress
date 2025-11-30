-- Create enum for submission status
CREATE TYPE public.submission_status AS ENUM ('in_progress', 'completed');

-- Add status column to submissions table
ALTER TABLE public.submissions
ADD COLUMN status public.submission_status NOT NULL DEFAULT 'in_progress';

-- Add index for status
CREATE INDEX idx_submissions_status ON public.submissions(status);

-- Comment
COMMENT ON COLUMN public.submissions.status IS 'Status of the submission: in_progress or completed';

