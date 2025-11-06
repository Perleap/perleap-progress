-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('teacher', 'student');

-- Create enum for assignment types
CREATE TYPE public.assignment_type AS ENUM ('text_essay', 'quiz_mcq', 'creative_task', 'discussion_prompt', 'multimedia');

-- Create enum for assignment status
CREATE TYPE public.assignment_status AS ENUM ('draft', 'published', 'archived');

-- Create enum for 5D snapshot sources
CREATE TYPE public.snapshot_source AS ENUM ('onboarding', 'assignment', 'reassess');

-- Teacher profiles table
CREATE TABLE public.teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subjects TEXT[] DEFAULT '{}',
  years_experience INTEGER,
  student_types TEXT,
  teaching_goals TEXT,
  style_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Student profiles table
CREATE TABLE public.student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences_quiz JSONB DEFAULT '{}',
  mentor_tone_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Classrooms table
CREATE TABLE public.classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  start_date DATE,
  end_date DATE,
  goals TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(classroom_id, student_id)
);

-- Assignments table
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type public.assignment_type NOT NULL DEFAULT 'text_essay',
  target_dimensions JSONB NOT NULL DEFAULT '{"cognitive": false, "emotional": false, "social": false, "creative": false, "behavioral": false}',
  instructions TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  status public.assignment_status NOT NULL DEFAULT 'draft',
  personalization_flag BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Submissions table
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text_body TEXT,
  file_url TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);

-- AI evaluations table
CREATE TABLE public.ai_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  scores JSONB NOT NULL DEFAULT '{"cognitive": 0, "emotional": 0, "social": 0, "creative": 0, "behavioral": 0}',
  narrative_feedback TEXT,
  progress_delta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id)
);

-- Teacher reviews table
CREATE TABLE public.teacher_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.ai_evaluations(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edited_feedback TEXT,
  published_to_student BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5D snapshots table
CREATE TABLE public.five_d_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source public.snapshot_source NOT NULL,
  scores JSONB NOT NULL DEFAULT '{"cognitive": 0, "emotional": 0, "social": 0, "creative": 0, "behavioral": 0}',
  delta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI lesson plans table
CREATE TABLE public.ai_lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  outline TEXT,
  activities JSONB DEFAULT '[]',
  skills TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.five_d_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_lesson_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teacher_profiles
CREATE POLICY "Users can view their own teacher profile"
  ON public.teacher_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own teacher profile"
  ON public.teacher_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own teacher profile"
  ON public.teacher_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for student_profiles
CREATE POLICY "Users can view their own student profile"
  ON public.student_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own student profile"
  ON public.student_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own student profile"
  ON public.student_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Teachers can view enrolled student profiles"
  ON public.student_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      INNER JOIN public.enrollments e ON e.classroom_id = c.id
      WHERE c.teacher_id = auth.uid()
      AND e.student_id = student_profiles.user_id
    )
  );

-- RLS Policies for classrooms
CREATE POLICY "Teachers can view their own classrooms"
  ON public.classrooms FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can create classrooms"
  ON public.classrooms FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own classrooms"
  ON public.classrooms FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view classrooms they're enrolled in"
  ON public.classrooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.classroom_id = classrooms.id
      AND enrollments.student_id = auth.uid()
    )
  );

-- RLS Policies for enrollments
CREATE POLICY "Teachers can view enrollments in their classrooms"
  ON public.enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms
      WHERE classrooms.id = enrollments.classroom_id
      AND classrooms.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own enrollments"
  ON public.enrollments FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can create their own enrollments"
  ON public.enrollments FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- RLS Policies for assignments
CREATE POLICY "Teachers can manage assignments in their classrooms"
  ON public.assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms
      WHERE classrooms.id = assignments.classroom_id
      AND classrooms.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view published assignments in enrolled classrooms"
  ON public.assignments FOR SELECT
  USING (
    status = 'published' AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.classroom_id = assignments.classroom_id
      AND enrollments.student_id = auth.uid()
    )
  );

-- RLS Policies for submissions
CREATE POLICY "Students can manage their own submissions"
  ON public.submissions FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers can view submissions in their classrooms"
  ON public.submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = submissions.assignment_id
      AND c.teacher_id = auth.uid()
    )
  );

-- RLS Policies for ai_evaluations
CREATE POLICY "Students can view evaluations of their submissions"
  ON public.ai_evaluations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions
      WHERE submissions.id = ai_evaluations.submission_id
      AND submissions.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view evaluations in their classrooms"
  ON public.ai_evaluations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      INNER JOIN public.assignments a ON a.id = s.assignment_id
      INNER JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE s.id = ai_evaluations.submission_id
      AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "System can create evaluations"
  ON public.ai_evaluations FOR INSERT
  WITH CHECK (true);

-- RLS Policies for teacher_reviews
CREATE POLICY "Teachers can manage reviews they created"
  ON public.teacher_reviews FOR ALL
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- RLS Policies for five_d_snapshots
CREATE POLICY "Users can view their own snapshots"
  ON public.five_d_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create snapshots"
  ON public.five_d_snapshots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Teachers can view snapshots of enrolled students"
  ON public.five_d_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      INNER JOIN public.enrollments e ON e.classroom_id = c.id
      WHERE c.teacher_id = auth.uid()
      AND e.student_id = five_d_snapshots.user_id
    )
  );

-- RLS Policies for ai_lesson_plans
CREATE POLICY "Teachers can manage their own lesson plans"
  ON public.ai_lesson_plans FOR ALL
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.classrooms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add default for invite_code
ALTER TABLE public.classrooms 
  ALTER COLUMN invite_code SET DEFAULT generate_invite_code();