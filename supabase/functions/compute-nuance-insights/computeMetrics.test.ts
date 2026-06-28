/**
 * Tests for Nuance metric computation.
 * Run with: deno test supabase/functions/compute-nuance-insights/computeMetrics.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  computeMetricsForAssignment,
  resolveAssignmentDurationSeconds,
  type NuanceEvent,
  type SubmissionTimingRow,
} from './computeMetrics.ts';

const STUDENT_ID = '11111111-1111-1111-1111-111111111111';
const ASSIGNMENT_ID = '22222222-2222-2222-2222-222222222222';
const CLASSROOM_ID = '33333333-3333-3333-3333-333333333333';

function evt(
  event_type: string,
  created_at: string,
  metadata: Record<string, unknown> = {},
): NuanceEvent {
  return {
    id: crypto.randomUUID(),
    student_id: STUDENT_ID,
    assignment_id: ASSIGNMENT_ID,
    submission_id: null,
    event_type,
    metadata,
    created_at,
  };
}

Deno.test('closes open blur interval on session_ended without page_focus', () => {
  const events = [
    evt('activity_opened', '2026-01-01T10:00:00.000Z'),
    evt('session_started', '2026-01-01T10:00:00.000Z'),
    evt('page_blur', '2026-01-01T10:01:00.000Z'),
    evt('session_ended', '2026-01-01T10:05:00.000Z'),
  ];

  const metrics = computeMetricsForAssignment(events, CLASSROOM_ID, 'in_progress');

  assertEquals(metrics.total_idle_time_ms, 4 * 60 * 1000);
  assertEquals(metrics.total_session_duration_ms, 5 * 60 * 1000);
  assertEquals(metrics.idle_ratio, 0.8);
});

Deno.test('accumulates in-tab idle start/end pairs', () => {
  const events = [
    evt('activity_opened', '2026-01-01T10:00:00.000Z'),
    evt('session_started', '2026-01-01T10:00:00.000Z'),
    evt('in_tab_idle_start', '2026-01-01T10:02:00.000Z'),
    evt('in_tab_idle_end', '2026-01-01T10:03:30.000Z'),
    evt('session_ended', '2026-01-01T10:10:00.000Z'),
  ];

  const metrics = computeMetricsForAssignment(events, CLASSROOM_ID, 'in_progress');

  assertEquals(metrics.total_idle_time_ms, 90 * 1000);
  assertEquals(metrics.idle_ratio, 0.15);
});

Deno.test('response_started sets first_interaction_latency_ms', () => {
  const events = [
    evt('activity_opened', '2026-01-01T10:00:00.000Z'),
    evt('session_started', '2026-01-01T10:00:00.000Z'),
    evt('response_started', '2026-01-01T10:00:45.000Z', { message_index: 0 }),
    evt('session_ended', '2026-01-01T10:05:00.000Z'),
  ];

  const metrics = computeMetricsForAssignment(events, CLASSROOM_ID, 'in_progress');

  assertEquals(metrics.first_interaction_latency_ms, 45 * 1000);
});

Deno.test('defensively closes open blur at last event when session_ended missing', () => {
  const events = [
    evt('activity_opened', '2026-01-01T10:00:00.000Z'),
    evt('session_started', '2026-01-01T10:00:00.000Z'),
    evt('page_blur', '2026-01-01T10:01:00.000Z'),
    evt('response_started', '2026-01-01T10:04:00.000Z'),
  ];

  const metrics = computeMetricsForAssignment(events, CLASSROOM_ID, 'in_progress');

  assertEquals(metrics.total_idle_time_ms, 3 * 60 * 1000);
});

function timingRow(
  overrides: Partial<SubmissionTimingRow> & Pick<SubmissionTimingRow, 'status'>,
): SubmissionTimingRow {
  return {
    student_id: STUDENT_ID,
    assignment_id: ASSIGNMENT_ID,
    attempt_number: 1,
    is_teacher_attempt: false,
    started_at: null,
    duration_seconds: null,
    submitted_at: null,
    ...overrides,
  };
}

Deno.test('resolveAssignmentDurationSeconds prefers latest completed attempt', () => {
  const rows = [
    timingRow({ status: 'completed', attempt_number: 1, duration_seconds: 120 }),
    timingRow({ status: 'completed', attempt_number: 2, duration_seconds: 300 }),
  ];
  assertEquals(resolveAssignmentDurationSeconds(rows), 300);
});

Deno.test('resolveAssignmentDurationSeconds excludes teacher attempts', () => {
  const rows = [
    timingRow({ status: 'completed', is_teacher_attempt: true, duration_seconds: 60 }),
    timingRow({ status: 'in_progress', started_at: '2026-01-01T10:00:00.000Z' }),
  ];
  const nowMs = new Date('2026-01-01T10:05:00.000Z').getTime();
  assertEquals(resolveAssignmentDurationSeconds(rows, nowMs), 300);
});

Deno.test('resolveAssignmentDurationSeconds returns null when no eligible rows', () => {
  assertEquals(
    resolveAssignmentDurationSeconds([
      timingRow({ status: 'completed', is_teacher_attempt: true, duration_seconds: 60 }),
    ]),
    null,
  );
});
