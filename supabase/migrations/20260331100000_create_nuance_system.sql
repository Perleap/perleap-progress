-- =============================================================
-- Nuance System: Student behavioral analytics
-- Tracks response latency, idle ratio, completion rate,
-- session continuity to generate teacher recommendations.
-- =============================================================

-- Event types for student behavioral tracking
CREATE TYPE nuance_event_type AS ENUM (
  'session_started',
  'session_ended',
  'response_started',
  'response_submitted',
  'page_blur',
  'page_focus',
  'activity_opened'
);

-- Raw behavioral events captured from the student client
CREATE TABLE student_nuance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL,
  event_type nuance_event_type NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nuance_events_student_assignment
  ON student_nuance_events (student_id, assignment_id, created_at DESC);

CREATE INDEX idx_nuance_events_assignment
  ON student_nuance_events (assignment_id, created_at DESC);

-- Cached computed metrics per student per assignment
CREATE TABLE student_nuance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  avg_response_latency_ms numeric,
  total_idle_time_ms numeric,
  idle_ratio numeric,
  completion_status text DEFAULT 'incomplete',
  focus_loss_count integer DEFAULT 0,
  resume_count integer DEFAULT 0,
  session_count integer DEFAULT 1,
  total_session_duration_ms numeric,
  first_interaction_latency_ms numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, assignment_id)
);

CREATE INDEX idx_nuance_metrics_classroom
  ON student_nuance_metrics (classroom_id);

CREATE INDEX idx_nuance_metrics_student_classroom
  ON student_nuance_metrics (student_id, classroom_id);

-- Generated recommendations (one strongest per student per classroom)
CREATE TABLE student_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  recommendation_type text NOT NULL,
  trigger_reason text NOT NULL,
  confidence_score numeric,
  recommendation_text text NOT NULL,
  supporting_metrics jsonb,
  UNIQUE(student_id, classroom_id)
);

CREATE INDEX idx_recommendations_classroom
  ON student_recommendations (classroom_id);

-- =============================================================
-- Row Level Security
-- =============================================================

ALTER TABLE student_nuance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_nuance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_recommendations ENABLE ROW LEVEL SECURITY;

-- Students can insert their own events
CREATE POLICY "Students can insert their own nuance events"
  ON student_nuance_events FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can read their own events
CREATE POLICY "Students can read their own nuance events"
  ON student_nuance_events FOR SELECT
  USING (auth.uid() = student_id);

-- Teachers can read events for students in their classrooms
CREATE POLICY "Teachers can read nuance events for their students"
  ON student_nuance_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classrooms c ON c.id = a.classroom_id
      WHERE a.id = student_nuance_events.assignment_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Service role can insert/update metrics (from Edge Function)
CREATE POLICY "Service can manage nuance metrics"
  ON student_nuance_metrics FOR ALL
  USING (true)
  WITH CHECK (true);

-- Teachers can read metrics for students in their classrooms
CREATE POLICY "Teachers can read nuance metrics for their classrooms"
  ON student_nuance_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = student_nuance_metrics.classroom_id
        AND c.teacher_id = auth.uid()
    )
  );

-- Service role can manage recommendations (from Edge Function)
CREATE POLICY "Service can manage recommendations"
  ON student_recommendations FOR ALL
  USING (true)
  WITH CHECK (true);

-- Teachers can read recommendations for students in their classrooms
CREATE POLICY "Teachers can read recommendations for their classrooms"
  ON student_recommendations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = student_recommendations.classroom_id
        AND c.teacher_id = auth.uid()
    )
  );
