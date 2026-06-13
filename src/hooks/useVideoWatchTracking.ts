import { useCallback, useEffect, useRef } from 'react';
import {
  buildVideoWatchPayload,
  flushVideoWatchProgressBeacon,
  upsertVideoWatchProgress,
} from '@/services/videoWatchService';
import type { VideoWatchTrackingContext } from '@/types/videoWatch';

const FLUSH_INTERVAL_MS = 15_000;
const MAX_TICK_DELTA_SECONDS = 2;
const COMPLETION_THRESHOLD = 0.95;

export function useVideoWatchTracking(tracking: VideoWatchTrackingContext | undefined) {
  const playCountDeltaRef = useRef(0);
  const watchSecondsDeltaRef = useRef(0);
  const completionCountDeltaRef = useRef(0);
  const lastPositionRef = useRef(0);
  const durationRef = useRef(0);
  const isPlayingRef = useRef(false);
  const lastTickMsRef = useRef<number | null>(null);
  const sessionCompletionEligibleRef = useRef(true);
  const completionCountedThisSessionRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;

  const canTrack = !!tracking?.resourceId && !!tracking.classroomId && !!tracking.studentUserId;

  const tryRecordCompletion = useCallback((currentTime: number, duration?: number) => {
    if (!sessionCompletionEligibleRef.current || completionCountedThisSessionRef.current) {
      return;
    }
    const dur =
      typeof duration === 'number' && Number.isFinite(duration) && duration > 0
        ? duration
        : durationRef.current;
    if (dur <= 0) return;
    if (currentTime >= dur * COMPLETION_THRESHOLD) {
      completionCountDeltaRef.current += 1;
      completionCountedThisSessionRef.current = true;
    }
  }, []);

  const flush = useCallback(async () => {
    const ctx = trackingRef.current;
    if (!ctx) return;

    const playCountDelta = playCountDeltaRef.current;
    const watchSecondsDelta = watchSecondsDeltaRef.current;
    const completionCountDelta = completionCountDeltaRef.current;
    const lastPositionSeconds = lastPositionRef.current;
    const durationSeconds = durationRef.current;

    if (
      playCountDelta === 0 &&
      watchSecondsDelta === 0 &&
      completionCountDelta === 0 &&
      lastPositionSeconds === 0
    ) {
      return;
    }

    playCountDeltaRef.current = 0;
    watchSecondsDeltaRef.current = 0;
    completionCountDeltaRef.current = 0;

    const payload = buildVideoWatchPayload(ctx, {
      playCountDelta,
      watchSecondsDelta,
      lastPositionSeconds,
      durationSeconds,
      completionCountDelta,
    });

    try {
      await upsertVideoWatchProgress(payload);
    } catch {
      playCountDeltaRef.current += playCountDelta;
      watchSecondsDeltaRef.current += watchSecondsDelta;
      completionCountDeltaRef.current += completionCountDelta;
    }
  }, []);

  const flushBeacon = useCallback(() => {
    const ctx = trackingRef.current;
    if (!ctx) return;

    const payload = buildVideoWatchPayload(ctx, {
      playCountDelta: playCountDeltaRef.current,
      watchSecondsDelta: watchSecondsDeltaRef.current,
      lastPositionSeconds: lastPositionRef.current,
      durationSeconds: durationRef.current,
      completionCountDelta: completionCountDeltaRef.current,
    });

    playCountDeltaRef.current = 0;
    watchSecondsDeltaRef.current = 0;
    completionCountDeltaRef.current = 0;
    flushVideoWatchProgressBeacon(payload);
  }, []);

  const accumulateWatchTime = useCallback((currentTime: number) => {
    const now = Date.now();
    if (isPlayingRef.current && lastTickMsRef.current != null) {
      const deltaSec = Math.min(MAX_TICK_DELTA_SECONDS, (now - lastTickMsRef.current) / 1000);
      watchSecondsDeltaRef.current += deltaSec;
    }
    lastTickMsRef.current = now;
    lastPositionRef.current = currentTime;
  }, []);

  const handlePlay = useCallback(() => {
    if (!canTrack) return;

    playCountDeltaRef.current += 1;
    sessionCompletionEligibleRef.current = true;
    completionCountedThisSessionRef.current = false;
    isPlayingRef.current = true;
    lastTickMsRef.current = Date.now();
  }, [canTrack]);

  const handlePause = useCallback(() => {
    if (!canTrack) return;
    isPlayingRef.current = false;
    lastTickMsRef.current = null;
    void flush();
  }, [canTrack, flush]);

  const handleTimeUpdate = useCallback(
    (currentTime: number, duration?: number) => {
      if (!canTrack) return;
      if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
        durationRef.current = duration;
      }
      accumulateWatchTime(currentTime);
      tryRecordCompletion(currentTime, duration);
    },
    [accumulateWatchTime, canTrack, tryRecordCompletion],
  );

  const handleSeeked = useCallback(
    (currentTime: number) => {
      if (!canTrack) return;
      sessionCompletionEligibleRef.current = false;
      lastPositionRef.current = currentTime;
    },
    [canTrack],
  );

  const handleEnded = useCallback(() => {
    if (!canTrack) return;
    tryRecordCompletion(lastPositionRef.current, durationRef.current);
    isPlayingRef.current = false;
    lastTickMsRef.current = null;
    if (durationRef.current > 0) {
      lastPositionRef.current = durationRef.current;
    }
    void flush();
  }, [canTrack, flush, tryRecordCompletion]);

  const handleLoadedMetadata = useCallback(
    (duration: number) => {
      if (!canTrack || !Number.isFinite(duration) || duration <= 0) return;
      durationRef.current = duration;
    },
    [canTrack],
  );

  useEffect(() => {
    if (!canTrack) return;

    flushTimerRef.current = setInterval(() => {
      if (isPlayingRef.current) {
        void flush();
      }
    }, FLUSH_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (isPlayingRef.current) {
          flushBeacon();
        } else {
          void flush();
        }
      }
    };

    const onBeforeUnload = () => {
      flushBeacon();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      void flush();
    };
  }, [canTrack, flush, flushBeacon]);

  return {
    handlePlay,
    handlePause,
    handleTimeUpdate,
    handleSeeked,
    handleEnded,
    handleLoadedMetadata,
    flush,
  };
}
