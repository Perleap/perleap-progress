import { supabase } from '@/api/client';

/** Kept in sync with Supabase Auth so unload-time fetch can send a Bearer token (sendBeacon cannot). */
let cachedAccessToken: string | null = null;
let cachedUserId: string | null = null;

void supabase.auth.getSession().then(({ data: { session } }) => {
  cachedAccessToken = session?.access_token ?? null;
  cachedUserId = session?.user?.id ?? null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token ?? null;
  cachedUserId = session?.user?.id ?? null;
});

export type NuanceEventType =
  | 'session_started'
  | 'session_ended'
  | 'response_started'
  | 'response_submitted'
  | 'page_blur'
  | 'page_focus'
  | 'activity_opened'
  | 'understanding_cue';

export interface NuanceEvent {
  student_id: string;
  assignment_id: string;
  submission_id?: string;
  event_type: NuanceEventType;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 50;

let eventQueue: NuanceEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing = false;

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flushQueue, FLUSH_INTERVAL_MS);
}

function stopFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

async function flushQueue(): Promise<void> {
  if (isFlushing || eventQueue.length === 0) return;

  isFlushing = true;
  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);

  try {
    let {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const { data } = await supabase.auth.refreshSession();
      session = data.session ?? null;
    }
    if (!session?.user?.id) {
      eventQueue.unshift(...batch);
      return;
    }

    const uid = session.user.id;
    const rows = batch.map((e) => ({
      ...e,
      student_id: uid,
    }));

    const { error } = await supabase.from('student_nuance_events').insert(rows as any);

    if (error) {
      console.error('[Nuance] Failed to flush events:', error.message);
      eventQueue.unshift(...batch);
    }
  } catch (err) {
    console.error('[Nuance] Flush exception:', err);
    eventQueue.unshift(...batch);
  } finally {
    isFlushing = false;
  }
}

/**
 * Queue a nuance event for batched insertion.
 * Events are flushed every 5s or when the session ends.
 */
export function trackNuanceEvent(event: NuanceEvent): void {
  if (import.meta.env.DEV && event.event_type === 'understanding_cue') {
    // eslint-disable-next-line no-console -- dev-only: confirm event reached queue before batch insert
    console.debug(
      '[Nuance] understanding_cue in client queue (→ POST student_nuance_events on flush, ~5s or unload)',
      { assignment_id: event.assignment_id, metadata: event.metadata },
    );
  }
  eventQueue.push({
    ...event,
    created_at: event.created_at ?? new Date().toISOString(),
  });

  startFlushTimer();

  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flushQueue();
  }
}

/**
 * Immediately flush all queued events.
 * Used on session end / page unload.
 */
export async function flushNuanceEvents(): Promise<void> {
  stopFlushTimer();
  await flushQueue();
}

/**
 * Best-effort flush for page unload: `fetch` + `keepalive` so we can attach
 * `Authorization` (sendBeacon cannot set headers, which caused 401 + RLS failures).
 */
export function flushNuanceEventsBeacon(): void {
  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0);
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const token = cachedAccessToken;
  const url = `${baseUrl}/rest/v1/student_nuance_events`;

  const uid = cachedUserId;
  if (!baseUrl || !anonKey || !token || !uid) {
    eventQueue.unshift(...batch);
    void flushQueue();
    return;
  }

  const rows = batch.map((e) => ({ ...e, student_id: uid }));

  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok) {
        console.error('[Nuance] Beacon flush failed:', res.status, res.statusText);
        eventQueue.unshift(...batch);
      }
    })
    .catch((err) => {
      console.error('[Nuance] Beacon flush error:', err);
      eventQueue.unshift(...batch);
    });
}

/**
 * Returns the count of pending (un-flushed) events.
 */
export function getPendingEventCount(): number {
  return eventQueue.length;
}
