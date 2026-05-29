-- Live Sessions: side table keyed by assignment_id holding media + AI-generated artifacts.
-- The owning assignment row (type = 'live_session') drives module flow, submissions, and 5D scoring.

CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES public.assignments(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  syllabus_section_id uuid REFERENCES public.syllabus_sections(id) ON DELETE SET NULL,
  session_type text NOT NULL DEFAULT 'workshop'
    CHECK (session_type IN ('workshop', 'lecture', 'practice')),
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'extracting', 'extracted', 'transcribing', 'ready', 'failed')),
  video_temp_path text,
  audio_path text,
  audio_chunk_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_seconds numeric,
  transcript text,
  summary text,
  timestamps jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_sessions_classroom_id_idx ON public.live_sessions(classroom_id);
CREATE INDEX IF NOT EXISTS live_sessions_assignment_id_idx ON public.live_sessions(assignment_id);

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage their live sessions" ON public.live_sessions;
CREATE POLICY "Teachers manage their live sessions"
  ON public.live_sessions FOR ALL
  USING (public.is_classroom_teacher(classroom_id, auth.uid()))
  WITH CHECK (public.is_classroom_teacher(classroom_id, auth.uid()));

-- Storage buckets: temp (raw video, deleted after extraction) + audio (kept for transcription/playback seeking).
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('live-session-temp', 'live-session-temp', false),
  ('live-session-audio', 'live-session-audio', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated manage live session temp objects" ON storage.objects;
CREATE POLICY "Authenticated manage live session temp objects"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'live-session-temp')
  WITH CHECK (bucket_id = 'live-session-temp');

DROP POLICY IF EXISTS "Authenticated manage live session audio objects" ON storage.objects;
CREATE POLICY "Authenticated manage live session audio objects"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'live-session-audio')
  WITH CHECK (bucket_id = 'live-session-audio');
