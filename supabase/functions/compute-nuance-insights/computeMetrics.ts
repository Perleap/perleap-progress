// ── Types ───────────────────────────────────────────────────────────

export interface NuanceEvent {
  id: string;
  student_id: string;
  assignment_id: string;
  submission_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface StudentMetrics {
  student_id: string;
  assignment_id: string;
  classroom_id: string;
  avg_response_latency_ms: number | null;
  total_idle_time_ms: number;
  idle_ratio: number;
  completion_status: string;
  focus_loss_count: number;
  resume_count: number;
  session_count: number;
  total_session_duration_ms: number;
  first_interaction_latency_ms: number | null;
  understanding_cue_count: number;
  /** Wall-clock seconds from attempt start to submit (latest completed non-teacher attempt). */
  assignment_duration_seconds: number | null;
}

export interface SubmissionTimingRow {
  student_id: string;
  assignment_id: string;
  status: string;
  attempt_number: number;
  is_teacher_attempt: boolean;
  started_at: string | null;
  duration_seconds: number | null;
  submitted_at: string | null;
}

/** Resolve per (student, assignment) duration from submission rows. */
export function resolveAssignmentDurationSeconds(
  rows: SubmissionTimingRow[],
  nowMs = Date.now(),
): number | null {
  const eligible = rows.filter((r) => !r.is_teacher_attempt);
  if (eligible.length === 0) return null;

  const completed = eligible
    .filter((r) => r.status === 'completed')
    .sort((a, b) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0));

  const latestCompleted = completed.find((r) => r.duration_seconds != null);
  if (latestCompleted?.duration_seconds != null) {
    return latestCompleted.duration_seconds;
  }

  const inProgress = eligible
    .filter((r) => r.status === 'in_progress' && r.started_at)
    .sort((a, b) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0));

  const active = inProgress[0];
  if (active?.started_at) {
    const startedMs = new Date(active.started_at).getTime();
    return Math.max(0, Math.round((nowMs - startedMs) / 1000));
  }

  return null;
}

function closeOpenIdlePeriod(
  totalIdleMs: number,
  lastIdleStartAt: number | null,
  endTs: number,
): { totalIdleMs: number; lastIdleStartAt: number | null } {
  if (lastIdleStartAt === null) {
    return { totalIdleMs, lastIdleStartAt: null };
  }
  return {
    totalIdleMs: totalIdleMs + (endTs - lastIdleStartAt),
    lastIdleStartAt: null,
  };
}

export function computeMetricsForAssignment(
  events: NuanceEvent[],
  classroomId: string,
  submissionStatus: string,
): StudentMetrics {
  const studentId = events[0].student_id;
  const assignmentId = events[0].assignment_id;

  const responseTimes: number[] = [];
  let totalIdleMs = 0;
  let focusLossCount = 0;
  let resumeCount = 0;
  let sessionCount = 0;
  let totalSessionMs = 0;
  let firstInteractionMs: number | null = null;
  let understandingCueCount = 0;

  let activityOpenedAt: number | null = null;
  let lastSessionStart: number | null = null;
  let lastBlurAt: number | null = null;
  let lastInTabIdleStartAt: number | null = null;

  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const evt of sorted) {
    const ts = new Date(evt.created_at).getTime();

    switch (evt.event_type) {
      case 'activity_opened':
        if (activityOpenedAt === null) activityOpenedAt = ts;
        break;

      case 'session_started':
        sessionCount++;
        lastSessionStart = ts;
        break;

      case 'session_ended':
        if (lastSessionStart !== null) {
          totalSessionMs += ts - lastSessionStart;
          lastSessionStart = null;
        }
        ({ totalIdleMs, lastIdleStartAt: lastBlurAt } = closeOpenIdlePeriod(
          totalIdleMs,
          lastBlurAt,
          ts,
        ));
        ({ totalIdleMs, lastIdleStartAt: lastInTabIdleStartAt } = closeOpenIdlePeriod(
          totalIdleMs,
          lastInTabIdleStartAt,
          ts,
        ));
        break;

      case 'page_blur':
        focusLossCount++;
        lastBlurAt = ts;
        break;

      case 'page_focus':
        resumeCount++;
        ({ totalIdleMs, lastIdleStartAt: lastBlurAt } = closeOpenIdlePeriod(
          totalIdleMs,
          lastBlurAt,
          ts,
        ));
        break;

      case 'in_tab_idle_start':
        lastInTabIdleStartAt = ts;
        break;

      case 'in_tab_idle_end':
        ({ totalIdleMs, lastIdleStartAt: lastInTabIdleStartAt } = closeOpenIdlePeriod(
          totalIdleMs,
          lastInTabIdleStartAt,
          ts,
        ));
        break;

      case 'response_started':
        if (firstInteractionMs === null && activityOpenedAt !== null) {
          firstInteractionMs = ts - activityOpenedAt;
        }
        break;

      case 'response_submitted': {
        const rt = evt.metadata?.response_time_ms;
        if (typeof rt === 'number' && rt > 0) {
          responseTimes.push(rt);
        }
        if (firstInteractionMs === null && activityOpenedAt !== null) {
          firstInteractionMs = ts - activityOpenedAt;
        }
        break;
      }

      case 'understanding_cue':
        understandingCueCount += 1;
        break;
    }
  }

  const lastEventTs = new Date(sorted[sorted.length - 1].created_at).getTime();

  // If session was never explicitly ended, estimate from last event
  if (lastSessionStart !== null) {
    totalSessionMs += lastEventTs - lastSessionStart;
  }

  // Defensive close for open blur / in-tab idle (missing session_ended in old data)
  ({ totalIdleMs, lastIdleStartAt: lastBlurAt } = closeOpenIdlePeriod(
    totalIdleMs,
    lastBlurAt,
    lastEventTs,
  ));
  ({ totalIdleMs, lastIdleStartAt: lastInTabIdleStartAt } = closeOpenIdlePeriod(
    totalIdleMs,
    lastInTabIdleStartAt,
    lastEventTs,
  ));

  const avgLatency =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null;

  const idleRatio = totalSessionMs > 0 ? totalIdleMs / totalSessionMs : 0;

  return {
    student_id: studentId,
    assignment_id: assignmentId,
    classroom_id: classroomId,
    avg_response_latency_ms: avgLatency,
    total_idle_time_ms: totalIdleMs,
    idle_ratio: Math.min(idleRatio, 1),
    completion_status: submissionStatus,
    focus_loss_count: focusLossCount,
    resume_count: resumeCount,
    session_count: Math.max(sessionCount, 1),
    total_session_duration_ms: totalSessionMs,
    first_interaction_latency_ms: firstInteractionMs,
    understanding_cue_count: understandingCueCount,
    assignment_duration_seconds: null,
  };
}
