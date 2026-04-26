import { useEffect, useRef, useCallback } from 'react';
import {
  trackNuanceEvent,
  flushNuanceEvents,
  flushNuanceEventsBeacon,
  type NuanceEventType,
} from '@/services/nuanceEventService';
import type { UnderstandingCueResult } from '@/lib/understandingCueDetection';

interface UseNuanceTrackingParams {
  studentId: string | undefined;
  assignmentId: string | undefined;
  submissionId: string | undefined;
  enabled?: boolean;
}

interface UseNuanceTrackingReturn {
  trackResponseSubmitted: (responseTimeMs: number, messageIndex: number) => void;
  trackResponseStarted: (messageIndex: number) => void;
  recordAiMessageArrival: () => void;
  getTimeSinceLastAiMessage: () => number | null;
  trackUnderstandingCue: (
    result: UnderstandingCueResult,
    messageLength: number,
    /** 0-based index in the full message list for the outgoing user message (matches response_submitted). */
    messageIndex: number,
  ) => void;
}

export function useNuanceTracking({
  studentId,
  assignmentId,
  submissionId,
  enabled = true,
}: UseNuanceTrackingParams): UseNuanceTrackingReturn {
  const lastAiMessageTimestamp = useRef<number | null>(null);
  const sessionActive = useRef(false);
  const hasTrackedOpen = useRef(false);

  const canTrack = enabled && !!studentId && !!assignmentId;

  const emit = useCallback(
    (eventType: NuanceEventType, metadata?: Record<string, unknown>) => {
      if (!canTrack) return;
      trackNuanceEvent({
        student_id: studentId!,
        assignment_id: assignmentId!,
        submission_id: submissionId,
        event_type: eventType,
        metadata,
      });
    },
    [canTrack, studentId, assignmentId, submissionId],
  );

  // -- Activity opened + session started on mount --
  useEffect(() => {
    if (!canTrack) return;

    if (!hasTrackedOpen.current) {
      emit('activity_opened');
      hasTrackedOpen.current = true;
    }

    emit('session_started');
    sessionActive.current = true;

    // -- Visibility change (blur / focus) --
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        emit('page_blur');
      } else {
        emit('page_focus');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // -- Page unload (best-effort beacon flush) --
    const handleBeforeUnload = () => {
      if (sessionActive.current) {
        emit('session_ended');
        flushNuanceEventsBeacon();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (sessionActive.current) {
        emit('session_ended');
        sessionActive.current = false;
        flushNuanceEvents();
      }
    };
  }, [canTrack, emit]);

  const trackResponseSubmitted = useCallback(
    (responseTimeMs: number, messageIndex: number) => {
      emit('response_submitted', {
        response_time_ms: responseTimeMs,
        message_index: messageIndex,
      });
    },
    [emit],
  );

  const trackResponseStarted = useCallback(
    (messageIndex: number) => {
      emit('response_started', { message_index: messageIndex });
    },
    [emit],
  );

  const recordAiMessageArrival = useCallback(() => {
    lastAiMessageTimestamp.current = Date.now();
  }, []);

  const getTimeSinceLastAiMessage = useCallback((): number | null => {
    if (lastAiMessageTimestamp.current === null) return null;
    return Date.now() - lastAiMessageTimestamp.current;
  }, []);

  const trackUnderstandingCue = useCallback(
    (result: UnderstandingCueResult, messageLength: number, messageIndex: number) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- dev-only visibility for understanding cue path
        console.debug('[Nuance] understanding cue (on send)', {
          hit: result.hit,
          reasonCodes: result.reasonCodes,
          localeHint: result.localeHint,
          messageIndex,
          messageLength,
          willQueueToSupabase: result.hit && canTrack,
        });
      }
      if (!result.hit) return;
      if (!canTrack) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug(
            '[Nuance] understanding_cue not emitted — tracking off (check: submission+no feedback, studentId, assignmentId, useNuanceTracking enabled)',
            { enabled, hasStudentId: !!studentId, hasAssignmentId: !!assignmentId },
          );
        }
        return;
      }
      emit('understanding_cue', {
        reason_codes: result.reasonCodes,
        locale_hint: result.localeHint,
        length_bucket: messageLength < 50 ? 'short' : messageLength < 200 ? 'medium' : 'long',
        message_index: messageIndex,
      });
    },
    [canTrack, emit, enabled, studentId, assignmentId],
  );

  return {
    trackResponseSubmitted,
    trackResponseStarted,
    recordAiMessageArrival,
    getTimeSinceLastAiMessage,
    trackUnderstandingCue,
  };
}
