-- Create hard_skill_assessments table
-- Stores individual hard skill assessments per submission
CREATE TABLE IF NOT EXISTS public.hard_skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  skill_component TEXT NOT NULL,
  current_level_percent INTEGER NOT NULL CHECK (current_level_percent >= 0 AND current_level_percent <= 100),
  proficiency_description TEXT NOT NULL,
  actionable_challenge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX idx_hard_skill_assessments_submission ON public.hard_skill_assessments(submission_id);
CREATE INDEX idx_hard_skill_assessments_assignment ON public.hard_skill_assessments(assignment_id);
CREATE INDEX idx_hard_skill_assessments_student ON public.hard_skill_assessments(student_id);

-- Enable RLS
ALTER TABLE public.hard_skill_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Students can view their own assessments
CREATE POLICY "Students can view their own hard skill assessments"
  ON public.hard_skill_assessments
  FOR SELECT
  USING (auth.uid() = student_id);

-- Teachers can view assessments for students in their classrooms
CREATE POLICY "Teachers can view assessments in their classrooms"
  ON public.hard_skill_assessments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = hard_skill_assessments.assignment_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Service role can insert assessments (for edge functions)
CREATE POLICY "Service role can insert hard skill assessments"
  ON public.hard_skill_assessments
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add comments
COMMENT ON TABLE public.hard_skill_assessments IS 'Stores Content Related Abilities (CRA) assessments for student hard skills per assignment submission';
COMMENT ON COLUMN public.hard_skill_assessments.domain IS 'Subject Area category (e.g., Algebra, Geometry)';
COMMENT ON COLUMN public.hard_skill_assessments.skill_component IS 'The specific hard skill/knowledge component being assessed';
COMMENT ON COLUMN public.hard_skill_assessments.current_level_percent IS 'Student proficiency level as percentage (0-100)';
COMMENT ON COLUMN public.hard_skill_assessments.proficiency_description IS 'Brief description of the proficiency level';
COMMENT ON COLUMN public.hard_skill_assessments.actionable_challenge IS 'Zone of Proximal Development (ZPD) recommendation for improvement';

