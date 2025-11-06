-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table for storing assignment conversations
CREATE TABLE public.assignment_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing AI-generated feedback
CREATE TABLE public.assignment_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_feedback TEXT,
  teacher_feedback TEXT,
  conversation_context JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assignment_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Students can view their own conversations"
ON public.assignment_conversations
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can create their own conversations"
ON public.assignment_conversations
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own conversations"
ON public.assignment_conversations
FOR UPDATE
USING (auth.uid() = student_id);

-- RLS Policies for feedback
CREATE POLICY "Students can view their own feedback"
ON public.assignment_feedback
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Teachers can view feedback for their assignments"
ON public.assignment_feedback
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.classrooms c ON c.id = a.classroom_id
    WHERE a.id = assignment_id AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY "System can create feedback"
ON public.assignment_feedback
FOR INSERT
WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_conversations_student ON public.assignment_conversations(student_id);
CREATE INDEX idx_conversations_assignment ON public.assignment_conversations(assignment_id);
CREATE INDEX idx_feedback_student ON public.assignment_feedback(student_id);
CREATE INDEX idx_feedback_assignment ON public.assignment_feedback(assignment_id);

-- Trigger for updated_at
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.assignment_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();