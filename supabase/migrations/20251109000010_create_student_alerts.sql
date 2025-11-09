-- Create student_alerts table for tracking wellbeing concerns
CREATE TABLE public.student_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('concerning', 'critical')),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('struggle', 'self_harm_risk', 'disengagement', 'wants_to_quit')),
  triggered_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_analysis TEXT NOT NULL,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.student_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Teachers can view alerts for their students (through classroom ownership)
CREATE POLICY "Teachers can view alerts for their students"
  ON public.student_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON a.classroom_id = c.id
      WHERE a.id = student_alerts.assignment_id
      AND c.teacher_id = auth.uid()
    )
  );

-- RLS Policy: Teachers can acknowledge alerts for their students
CREATE POLICY "Teachers can acknowledge alerts"
  ON public.student_alerts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON a.classroom_id = c.id
      WHERE a.id = student_alerts.assignment_id
      AND c.teacher_id = auth.uid()
    )
  );

-- RLS Policy: System can create alerts (service role)
CREATE POLICY "System can create alerts"
  ON public.student_alerts FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_student_alerts_student_id ON public.student_alerts(student_id);
CREATE INDEX idx_student_alerts_submission_id ON public.student_alerts(submission_id);
CREATE INDEX idx_student_alerts_assignment_id ON public.student_alerts(assignment_id);
CREATE INDEX idx_student_alerts_alert_level ON public.student_alerts(alert_level);
CREATE INDEX idx_student_alerts_is_acknowledged ON public.student_alerts(is_acknowledged);
CREATE INDEX idx_student_alerts_created_at ON public.student_alerts(created_at DESC);

-- Add comments
COMMENT ON TABLE public.student_alerts IS 'Stores wellbeing alerts for students based on conversation analysis';
COMMENT ON COLUMN public.student_alerts.alert_level IS 'Severity: concerning (moderate issues) or critical (immediate attention needed)';
COMMENT ON COLUMN public.student_alerts.alert_type IS 'Type of concern: struggle, self_harm_risk, disengagement, wants_to_quit';
COMMENT ON COLUMN public.student_alerts.triggered_messages IS 'Array of {message_index, content, reason} objects';

