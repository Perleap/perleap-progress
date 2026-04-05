-- Migrate any existing quiz_mcq rows to questions
UPDATE public.assignments SET type = 'questions' WHERE type = 'quiz_mcq';

-- Create test_questions table
CREATE TABLE public.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'open_ended')),
  options JSONB,
  correct_option_id TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_test_questions_assignment ON public.test_questions(assignment_id);

-- Create test_responses table
CREATE TABLE public.test_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.test_questions(id) ON DELETE CASCADE,
  selected_option_id TEXT,
  text_answer TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(submission_id, question_id)
);

CREATE INDEX idx_test_responses_submission ON public.test_responses(submission_id);

-- RLS for test_questions
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage test questions for their assignments"
  ON public.test_questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = test_questions.assignment_id
        AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = test_questions.assignment_id
        AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can read test questions for assignments they are enrolled in"
  ON public.test_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.enrollments e ON e.classroom_id = a.classroom_id
      WHERE a.id = test_questions.assignment_id
        AND e.student_id = auth.uid()
    )
  );

-- RLS for test_responses
ALTER TABLE public.test_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can insert their own test responses"
  ON public.test_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = test_responses.submission_id
        AND s.student_id = auth.uid()
    )
  );

CREATE POLICY "Students can read their own test responses"
  ON public.test_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = test_responses.submission_id
        AND s.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can read test responses for their assignments"
  ON public.test_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = test_responses.submission_id
        AND c.teacher_id = auth.uid()
    )
  );
