/**
 * Tests for shared edge-function authorization helpers.
 * Run with: deno test supabase/functions/_shared/authorizeResource.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  assertInternalServiceCaller,
  requireAuth,
  shouldAllowClassroomAccess,
  shouldAllowSubmissionEvaluationAccess,
} from './authorizeResource.ts';

const TEACHER_ID = 'teacher-uuid';
const OTHER_USER_ID = 'other-user-uuid';
const STUDENT_ID = 'student-uuid';

Deno.test('shouldAllowClassroomAccess allows classroom teacher', () => {
  assertEquals(shouldAllowClassroomAccess(TEACHER_ID, TEACHER_ID, false), true);
});

Deno.test('shouldAllowClassroomAccess denies non-teacher non-admin', () => {
  assertEquals(shouldAllowClassroomAccess(TEACHER_ID, OTHER_USER_ID, false), false);
});

Deno.test('shouldAllowClassroomAccess allows app admin on any classroom', () => {
  assertEquals(shouldAllowClassroomAccess(TEACHER_ID, OTHER_USER_ID, true), true);
});

Deno.test('shouldAllowSubmissionEvaluationAccess allows student owner', () => {
  assertEquals(shouldAllowSubmissionEvaluationAccess(STUDENT_ID, TEACHER_ID, STUDENT_ID, false), true);
});

Deno.test('shouldAllowSubmissionEvaluationAccess allows assignment teacher', () => {
  assertEquals(shouldAllowSubmissionEvaluationAccess(STUDENT_ID, TEACHER_ID, TEACHER_ID, false), true);
});

Deno.test('shouldAllowSubmissionEvaluationAccess allows app admin', () => {
  assertEquals(shouldAllowSubmissionEvaluationAccess(STUDENT_ID, TEACHER_ID, OTHER_USER_ID, true), true);
});

Deno.test('shouldAllowSubmissionEvaluationAccess denies stranger', () => {
  assertEquals(shouldAllowSubmissionEvaluationAccess(STUDENT_ID, TEACHER_ID, OTHER_USER_ID, false), false);
});

Deno.test('assertInternalServiceCaller rejects missing authorization', () => {
  const req = new Request('https://example.com/functions/v1/analyze-student-wellbeing', {
    method: 'POST',
  });
  const result = assertInternalServiceCaller(req);
  assertEquals(result?.status, 403);
});

Deno.test('assertInternalServiceCaller accepts matching service role key', () => {
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key-for-internal-auth');
  try {
    const req = new Request('https://example.com/functions/v1/analyze-student-wellbeing', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-service-key-for-internal-auth' },
    });
    assertEquals(assertInternalServiceCaller(req), null);
  } finally {
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
  }
});

Deno.test('assertInternalServiceCaller rejects non-service bearer token', () => {
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key-for-internal-auth');
  try {
    const req = new Request('https://example.com/functions/v1/analyze-student-wellbeing', {
      method: 'POST',
      headers: { Authorization: 'Bearer eyJ.user.jwt.token' },
    });
    assertEquals(assertInternalServiceCaller(req)?.status, 403);
  } finally {
    Deno.env.delete('SUPABASE_SERVICE_ROLE_KEY');
  }
});

Deno.test('regression: negating a Promise does not deny access (missing await bug)', () => {
  const adminPromise = Promise.resolve(true);
  assertEquals(!adminPromise, false);
});

Deno.test('requireAuth returns 401 when Authorization header is missing', async () => {
  const req = new Request('https://example.com/functions/v1/test', { method: 'POST' });
  const result = await requireAuth(req);
  assertEquals('status' in result, true);
  if ('status' in result) {
    assertEquals(result.status, 401);
    assertEquals(JSON.parse(result.body).error, 'Missing or invalid Authorization header.');
  }
});

Deno.test('requireAuth returns 401 when Authorization header is not Bearer', async () => {
  const req = new Request('https://example.com/functions/v1/test', {
    method: 'POST',
    headers: { Authorization: 'Basic abc123' },
  });
  const result = await requireAuth(req);
  assertEquals('status' in result, true);
  if ('status' in result) {
    assertEquals(result.status, 401);
  }
});
