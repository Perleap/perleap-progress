import { supabase } from '@/api/client';
import type { VideoWatchTrackingContext } from '@/types/videoWatch';

export interface VideoWatchFlushPayload {
  resourceId: string;
  lessonBlockId?: string | null;
  classroomId: string;
  playCountDelta: number;
  watchSecondsDelta: number;
  lastPositionSeconds: number;
  durationSeconds: number;
  completionCountDelta: number;
}

let cachedAccessToken: string | null = null;

void supabase.auth.getSession().then(({ data: { session } }) => {
  cachedAccessToken = session?.access_token ?? null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token ?? null;
});

export async function upsertVideoWatchProgress(
  payload: VideoWatchFlushPayload,
): Promise<void> {
  const { error } = await supabase.rpc('upsert_video_watch_progress', {
    p_resource_id: payload.resourceId,
    p_lesson_block_id: payload.lessonBlockId ?? null,
    p_classroom_id: payload.classroomId,
    p_play_count_delta: payload.playCountDelta,
    p_watch_seconds_delta: payload.watchSecondsDelta,
    p_last_position_seconds: payload.lastPositionSeconds,
    p_duration_seconds: payload.durationSeconds,
    p_completion_count_delta: payload.completionCountDelta,
  });

  if (error) {
    console.error('[VideoWatch] Failed to upsert progress:', error.message);
    throw error;
  }
}

function hasFlushData(payload: VideoWatchFlushPayload): boolean {
  return (
    payload.playCountDelta !== 0 ||
    payload.watchSecondsDelta !== 0 ||
    payload.completionCountDelta !== 0 ||
    payload.lastPositionSeconds !== 0
  );
}

/** Best-effort flush on page unload via fetch keepalive. */
export function flushVideoWatchProgressBeacon(payload: VideoWatchFlushPayload): void {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const token = cachedAccessToken;

  if (!baseUrl || !anonKey || !token) return;
  if (!hasFlushData(payload)) return;

  const url = `${baseUrl}/rest/v1/rpc/upsert_video_watch_progress`;

  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      p_resource_id: payload.resourceId,
      p_lesson_block_id: payload.lessonBlockId ?? null,
      p_classroom_id: payload.classroomId,
      p_play_count_delta: payload.playCountDelta,
      p_watch_seconds_delta: payload.watchSecondsDelta,
      p_last_position_seconds: payload.lastPositionSeconds,
      p_duration_seconds: payload.durationSeconds,
      p_completion_count_delta: payload.completionCountDelta,
    }),
    keepalive: true,
  }).catch((err) => {
    console.error('[VideoWatch] Beacon flush error:', err);
  });
}

export function buildVideoWatchPayload(
  tracking: VideoWatchTrackingContext,
  deltas: {
    playCountDelta: number;
    watchSecondsDelta: number;
    lastPositionSeconds: number;
    durationSeconds: number;
    completionCountDelta: number;
  },
): VideoWatchFlushPayload {
  return {
    resourceId: tracking.resourceId,
    lessonBlockId: tracking.lessonBlockId ?? null,
    classroomId: tracking.classroomId,
    playCountDelta: deltas.playCountDelta,
    watchSecondsDelta: deltas.watchSecondsDelta,
    lastPositionSeconds: deltas.lastPositionSeconds,
    durationSeconds: deltas.durationSeconds,
    completionCountDelta: deltas.completionCountDelta,
  };
}
