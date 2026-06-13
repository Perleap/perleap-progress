-- Per-student video watch analytics (plays, position, completion)

CREATE TABLE public.video_watch_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.activity_list(id) ON DELETE CASCADE,
  lesson_block_id text,
  student_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  play_count integer NOT NULL DEFAULT 0,
  total_watch_seconds numeric NOT NULL DEFAULT 0,
  last_position_seconds numeric NOT NULL DEFAULT 0,
  max_position_seconds numeric NOT NULL DEFAULT 0,
  duration_seconds numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  first_watched_at timestamptz NOT NULL DEFAULT now(),
  last_watched_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_watch_progress_unique_student_video
    UNIQUE NULLS NOT DISTINCT (resource_id, lesson_block_id, student_user_id)
);

CREATE INDEX idx_video_watch_progress_classroom
  ON public.video_watch_progress (classroom_id);

CREATE INDEX idx_video_watch_progress_resource
  ON public.video_watch_progress (resource_id, lesson_block_id);

ALTER TABLE public.video_watch_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own video watch progress"
  ON public.video_watch_progress
  FOR SELECT
  TO authenticated
  USING (student_user_id = (SELECT auth.uid()));

CREATE POLICY "Students can insert own video watch progress"
  ON public.video_watch_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_user_id = (SELECT auth.uid())
    AND public.is_enrolled_in_classroom(classroom_id, (SELECT auth.uid()))
  );

CREATE POLICY "Students can update own video watch progress"
  ON public.video_watch_progress
  FOR UPDATE
  TO authenticated
  USING (student_user_id = (SELECT auth.uid()))
  WITH CHECK (
    student_user_id = (SELECT auth.uid())
    AND public.is_enrolled_in_classroom(classroom_id, (SELECT auth.uid()))
  );

CREATE POLICY "Teachers can read video watch progress for their classrooms"
  ON public.video_watch_progress
  FOR SELECT
  TO authenticated
  USING (public.is_classroom_teacher(classroom_id, (SELECT auth.uid())));

CREATE POLICY "Admins can read all video watch progress"
  ON public.video_watch_progress
  FOR SELECT
  TO authenticated
  USING (public.is_app_admin((SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.upsert_video_watch_progress(
  p_resource_id uuid,
  p_lesson_block_id text,
  p_classroom_id uuid,
  p_play_count_delta integer,
  p_watch_seconds_delta numeric,
  p_last_position_seconds numeric,
  p_duration_seconds numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_completed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_enrolled_in_classroom(p_classroom_id, v_uid) THEN
    RAISE EXCEPTION 'Not enrolled in classroom';
  END IF;

  v_completed := p_duration_seconds > 0
    AND p_last_position_seconds >= (p_duration_seconds * 0.95);

  INSERT INTO public.video_watch_progress (
    resource_id,
    lesson_block_id,
    student_user_id,
    classroom_id,
    play_count,
    total_watch_seconds,
    last_position_seconds,
    max_position_seconds,
    duration_seconds,
    completed,
    first_watched_at,
    last_watched_at
  ) VALUES (
    p_resource_id,
    p_lesson_block_id,
    v_uid,
    p_classroom_id,
    GREATEST(0, COALESCE(p_play_count_delta, 0)),
    GREATEST(0, COALESCE(p_watch_seconds_delta, 0)),
    GREATEST(0, COALESCE(p_last_position_seconds, 0)),
    GREATEST(0, COALESCE(p_last_position_seconds, 0)),
    GREATEST(0, COALESCE(p_duration_seconds, 0)),
    v_completed,
    now(),
    now()
  )
  ON CONFLICT ON CONSTRAINT video_watch_progress_unique_student_video
  DO UPDATE SET
    play_count = video_watch_progress.play_count + GREATEST(0, COALESCE(p_play_count_delta, 0)),
    total_watch_seconds = video_watch_progress.total_watch_seconds + GREATEST(0, COALESCE(p_watch_seconds_delta, 0)),
    last_position_seconds = GREATEST(0, COALESCE(p_last_position_seconds, video_watch_progress.last_position_seconds)),
    max_position_seconds = GREATEST(
      video_watch_progress.max_position_seconds,
      GREATEST(0, COALESCE(p_last_position_seconds, 0))
    ),
    duration_seconds = CASE
      WHEN COALESCE(p_duration_seconds, 0) > 0 THEN p_duration_seconds
      ELSE video_watch_progress.duration_seconds
    END,
    completed = video_watch_progress.completed OR v_completed,
    last_watched_at = now();

END;
$$;

REVOKE ALL ON FUNCTION public.upsert_video_watch_progress(uuid, text, uuid, integer, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_video_watch_progress(uuid, text, uuid, integer, numeric, numeric, numeric) TO authenticated;
