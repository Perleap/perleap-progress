-- Track how many times a student finished a video (>= 95% continuous playback per play session)

ALTER TABLE public.video_watch_progress
  ADD COLUMN IF NOT EXISTS completion_count integer NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.upsert_video_watch_progress(uuid, text, uuid, integer, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.upsert_video_watch_progress(
  p_resource_id uuid,
  p_lesson_block_id text,
  p_classroom_id uuid,
  p_play_count_delta integer,
  p_watch_seconds_delta numeric,
  p_last_position_seconds numeric,
  p_duration_seconds numeric,
  p_completion_count_delta integer DEFAULT 0
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
    completion_count,
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
    v_completed OR GREATEST(0, COALESCE(p_completion_count_delta, 0)) > 0,
    GREATEST(0, COALESCE(p_completion_count_delta, 0)),
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
    completion_count = video_watch_progress.completion_count + GREATEST(0, COALESCE(p_completion_count_delta, 0)),
    completed = video_watch_progress.completed
      OR v_completed
      OR GREATEST(0, COALESCE(p_completion_count_delta, 0)) > 0,
    last_watched_at = now();

END;
$$;

REVOKE ALL ON FUNCTION public.upsert_video_watch_progress(uuid, text, uuid, integer, numeric, numeric, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_video_watch_progress(uuid, text, uuid, integer, numeric, numeric, numeric, integer) TO authenticated;
