import { useEffect, useRef, useCallback } from 'react';
import {
  queueClipboardEvent,
  flushClipboardEvents,
  flushClipboardEventsBeacon,
  linkChatPasteToMessage,
  type ClipboardSourceKind,
} from '@/services/clipboardEventService';
import {
  resolveClipboardCopyFromSelection,
  type ResolvedClipboardCopy,
} from '@/lib/clipboardSourceResolution';

export interface TrackCopyParams {
  copiedText: string;
  sourceKind: ClipboardSourceKind;
  messageIndex?: number;
  sentenceIndex?: number;
  sentenceText?: string;
  contextKey?: string;
}

export interface TrackPasteParams {
  pastedText: string;
  sourceKind: ClipboardSourceKind;
  contextKey?: string;
}

export interface AssignmentClipboardTrackingCallbacks {
  trackCopy: (params: TrackCopyParams) => void;
  trackPaste: (params: TrackPasteParams) => void;
  linkRecentChatPastes: (messageIndex: number) => void;
  handleWorkspaceCopy: (root: HTMLElement | null) => void;
}

interface UseAssignmentClipboardTrackingParams {
  studentId: string | undefined;
  assignmentId: string | undefined;
  submissionId: string | undefined;
  enabled?: boolean;
}

const COPY_DEDUPE_MS = 2000;

export function useAssignmentClipboardTracking({
  studentId,
  assignmentId,
  submissionId,
  enabled = true,
}: UseAssignmentClipboardTrackingParams): AssignmentClipboardTrackingCallbacks {
  const canTrack = enabled && !!studentId && !!assignmentId && !!submissionId;
  const lastCopyRef = useRef<{ text: string; at: number } | null>(null);

  useEffect(() => {
    if (!canTrack) return;

    const handleBeforeUnload = () => {
      flushClipboardEventsBeacon();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void flushClipboardEvents();
    };
  }, [canTrack]);

  const emitCopy = useCallback(
    (params: TrackCopyParams) => {
      if (!canTrack) return;
      const text = params.copiedText.trim();
      if (!text) return;

      const now = Date.now();
      const last = lastCopyRef.current;
      if (last && last.text === text && now - last.at < COPY_DEDUPE_MS) return;
      lastCopyRef.current = { text, at: now };

      queueClipboardEvent({
        submission_id: submissionId!,
        assignment_id: assignmentId!,
        event_type: 'copy',
        source_kind: params.sourceKind,
        copied_text: text,
        message_index: params.messageIndex,
        sentence_index: params.sentenceIndex,
        sentence_text: params.sentenceText,
        context_key: params.contextKey,
      });
    },
    [canTrack, submissionId, assignmentId],
  );

  const trackCopy = useCallback(
    (params: TrackCopyParams) => {
      emitCopy(params);
    },
    [emitCopy],
  );

  const trackPaste = useCallback(
    (params: TrackPasteParams) => {
      if (!canTrack) return;
      const text = params.pastedText.trim();
      if (!text) return;

      queueClipboardEvent({
        submission_id: submissionId!,
        assignment_id: assignmentId!,
        event_type: 'paste',
        source_kind: params.sourceKind,
        pasted_text: text,
        context_key: params.contextKey,
      });
    },
    [canTrack, submissionId, assignmentId],
  );

  const linkRecentChatPastes = useCallback(
    (messageIndex: number) => {
      if (!canTrack || !submissionId) return;
      void linkChatPasteToMessage(submissionId, messageIndex);
    },
    [canTrack, submissionId],
  );

  const handleWorkspaceCopy = useCallback(
    (root: HTMLElement | null) => {
      const resolved: ResolvedClipboardCopy | null = resolveClipboardCopyFromSelection(root);
      if (!resolved) return;
      emitCopy(resolved);
    },
    [emitCopy],
  );

  return {
    trackCopy,
    trackPaste,
    linkRecentChatPastes,
    handleWorkspaceCopy,
  };
}
