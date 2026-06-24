import { supabase } from '@/api/client';

export type ClipboardEventType = 'copy' | 'paste';

export type ClipboardSourceKind =
  | 'assistant_message'
  | 'user_message'
  | 'chat_input'
  | 'student_facing_task'
  | 'assignment_instructions'
  | 'essay'
  | 'test_answer'
  | 'langchain_field'
  | 'page_unknown';

export interface ClipboardEventPayload {
  submission_id: string;
  assignment_id: string;
  event_type: ClipboardEventType;
  source_kind: ClipboardSourceKind;
  copied_text?: string;
  pasted_text?: string;
  message_index?: number;
  sentence_index?: number;
  sentence_text?: string;
  context_key?: string;
  linked_message_index?: number;
}

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 30;

let eventQueue: ClipboardEventPayload[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => void flushQueue(), FLUSH_INTERVAL_MS);
}

function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

async function flushOne(payload: ClipboardEventPayload): Promise<boolean> {
  const { data, error } = await supabase.rpc('record_assignment_clipboard_event', {
    p_payload: payload,
  });
  if (error) {
    console.error('[Clipboard] RPC failed:', error.message);
    return false;
  }
  const result = data as { ok?: boolean } | null;
  return result?.ok === true;
}

async function flushQueue(): Promise<void> {
  if (isFlushing || eventQueue.length === 0) return;

  isFlushing = true;
  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      eventQueue.unshift(...batch);
      return;
    }

    for (const payload of batch) {
      const ok = await flushOne(payload);
      if (!ok) {
        eventQueue.unshift(payload);
      }
    }
  } catch (err) {
    console.error('[Clipboard] Flush exception:', err);
    eventQueue.unshift(...batch);
  } finally {
    isFlushing = false;
  }
}

export function queueClipboardEvent(payload: ClipboardEventPayload): void {
  eventQueue.push(payload);
  startFlushTimer();
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    void flushQueue();
  }
}

export async function flushClipboardEvents(): Promise<void> {
  stopFlushTimer();
  await flushQueue();
}

export function flushClipboardEventsBeacon(): void {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0);
  void (async () => {
    for (const payload of batch) {
      const ok = await flushOne(payload);
      if (!ok) eventQueue.unshift(payload);
    }
  })();
}

export async function linkChatPasteToMessage(
  submissionId: string,
  messageIndex: number,
): Promise<void> {
  const { error } = await supabase.rpc('link_assignment_clipboard_paste_messages', {
    p_submission_id: submissionId,
    p_message_index: messageIndex,
    p_since: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  });
  if (error) {
    console.error('[Clipboard] link paste failed:', error.message);
  }
}
