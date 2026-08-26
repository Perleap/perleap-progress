/**
 * Shared edge-function authorization helpers.
 * Verify JWT, load resources from DB, and assert caller ownership or role.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import {
  createSupabaseClient,
  getServiceRoleKey,
  isAppAdmin,
} from '../shared/supabase.ts';

export type AuthFailure = { status: 401 | 403 | 404; body: string };

export type AuthorizedUser = { user: { id: string } };

export type AuthorizedSubmissionAccess = {
  user: { id: string };
  learnerUserId: string;
  assignmentId: string;
};

export type AuthorizedClassroomAccess = {
  supabase: SupabaseClient;
};

export type AuthorizedSubmissionEvaluationAccess = {
  user: { id: string };
  submissionId: string;
  studentId: string;
  assignmentId: string;
  supabase: SupabaseClient;
};

const DEFAULT_JSON_HEADERS = { 'Content-Type': 'application/json' };

export function shouldAllowClassroomAccess(
  teacherId: string,
  userId: string,
  isAdmin: boolean,
): boolean {
  return teacherId === userId || isAdmin;
}

export function shouldAllowSubmissionEvaluationAccess(
  studentId: string,
  teacherId: string | null,
  userId: string,
  isAdmin: boolean,
): boolean {
  return studentId === userId || (teacherId !== null && teacherId === userId) || isAdmin;
}

export function authFailureToResponse(
  failure: AuthFailure,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(failure.body, {
    status: failure.status,
    headers: { ...DEFAULT_JSON_HEADERS, ...extraHeaders },
  });
}

export async function requireAuth(req: Request): Promise<AuthorizedUser | AuthFailure> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      status: 401,
      body: JSON.stringify({ error: 'Missing or invalid Authorization header.' }),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase configuration missing');
  }

  const jwtClient = createClient(supabaseUrl, serviceKey);
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const {
    data: { user },
    error: userError,
  } = await jwtClient.auth.getUser(token);

  if (userError || !user) {
    return {
      status: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  return { user: { id: user.id } };
}

export async function assertClassroomTeacherOrAdminAccess(
  userId: string,
  classroomId: string,
  supabase: SupabaseClient = createSupabaseClient(),
): Promise<AuthorizedClassroomAccess | AuthFailure> {
  const { data: classroom, error } = await supabase
    .from('classrooms')
    .select('teacher_id')
    .eq('id', classroomId)
    .maybeSingle();

  if (error || !classroom) {
    return {
      status: 404,
      body: JSON.stringify({ error: 'Classroom not found' }),
    };
  }

  const teacherId = (classroom as { teacher_id: string }).teacher_id;
  const admin = await isAppAdmin(userId);
  if (!shouldAllowClassroomAccess(teacherId, userId, admin)) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  return { supabase };
}

export async function assertSubmissionAccess(
  userId: string,
  submissionId: string,
  expectedAssignmentId: string,
  supabase: SupabaseClient = createSupabaseClient(),
): Promise<AuthorizedSubmissionAccess | AuthFailure> {
  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .select('id, student_id, assignment_id')
    .eq('id', submissionId)
    .maybeSingle();

  if (subErr || !submission) {
    return {
      status: 404,
      body: JSON.stringify({ error: 'Submission not found.' }),
    };
  }

  if (submission.assignment_id !== expectedAssignmentId) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Assignment does not match this submission.' }),
    };
  }

  const viewerIsOwner = submission.student_id === userId;
  const viewerIsAdmin = !viewerIsOwner && (await isAppAdmin(userId));

  if (!viewerIsOwner && !viewerIsAdmin) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  return {
    user: { id: userId },
    learnerUserId: submission.student_id as string,
    assignmentId: submission.assignment_id as string,
  };
}

/**
 * Scaffold for PR-SEC-003: teacher of assignment's classroom or app admin.
 */
export async function assertAssignmentTeacherOrAdmin(
  userId: string,
  assignmentId: string,
  supabase: SupabaseClient = createSupabaseClient(),
): Promise<AuthFailure | null> {
  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('id, classrooms(teacher_id)')
    .eq('id', assignmentId)
    .maybeSingle();

  if (error || !assignment) {
    return {
      status: 404,
      body: JSON.stringify({ error: 'Assignment not found.' }),
    };
  }

  const teacherId = (assignment.classrooms as { teacher_id: string } | null)?.teacher_id;
  if (!teacherId) {
    return {
      status: 404,
      body: JSON.stringify({ error: 'Assignment not found.' }),
    };
  }

  const admin = await isAppAdmin(userId);
  if (!shouldAllowClassroomAccess(teacherId, userId, admin)) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  return null;
}

/**
 * Internal edge-to-edge calls only (service role bearer).
 */
export function assertInternalServiceCaller(req: Request): AuthFailure | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  try {
    if (token === getServiceRoleKey()) {
      return null;
    }
  } catch {
    // fall through to forbidden
  }

  return {
    status: 403,
    body: JSON.stringify({ error: 'Forbidden' }),
  };
}

export async function assertSubmissionEvaluationAccess(
  userId: string,
  submissionId: string,
  expectedAssignmentId?: string,
  supabase: SupabaseClient = createSupabaseClient(),
): Promise<AuthorizedSubmissionEvaluationAccess | AuthFailure> {
  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .select('id, student_id, assignment_id')
    .eq('id', submissionId)
    .maybeSingle();

  if (subErr || !submission) {
    return {
      status: 404,
      body: JSON.stringify({ error: 'Submission not found.' }),
    };
  }

  const assignmentId = submission.assignment_id as string;
  if (expectedAssignmentId && assignmentId !== expectedAssignmentId) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Assignment does not match this submission.' }),
    };
  }

  const { data: assignment, error: assignErr } = await supabase
    .from('assignments')
    .select('id, classrooms(teacher_id)')
    .eq('id', assignmentId)
    .maybeSingle();

  if (assignErr || !assignment) {
    return {
      status: 404,
      body: JSON.stringify({ error: 'Assignment not found.' }),
    };
  }

  const teacherId = (assignment.classrooms as { teacher_id: string } | null)?.teacher_id ?? null;
  const admin = await isAppAdmin(userId);
  const studentId = submission.student_id as string;

  if (!shouldAllowSubmissionEvaluationAccess(studentId, teacherId, userId, admin)) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  return {
    user: { id: userId },
    submissionId: submission.id as string,
    studentId,
    assignmentId,
    supabase,
  };
}

/**
 * Teacher-only gate for teacher-facing AI tools (admins allowed).
 */
export async function requireAuthenticatedTeacher(
  userId: string,
  supabase: SupabaseClient = createSupabaseClient(),
): Promise<AuthFailure | null> {
  if (await isAppAdmin(userId)) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from('teacher_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !profile) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  return null;
}

export async function assertLiveSessionTeacherOrAdminAccess(
  userId: string,
  liveSessionId: string,
  supabase: SupabaseClient = createSupabaseClient(),
): Promise<AuthorizedClassroomAccess | AuthFailure> {
  const { data: session, error } = await supabase
    .from('live_sessions')
    .select('classroom_id')
    .eq('id', liveSessionId)
    .maybeSingle();

  if (error || !session) {
    return {
      status: 404,
      body: JSON.stringify({ error: 'Live session not found.' }),
    };
  }

  return assertClassroomTeacherOrAdminAccess(
    userId,
    (session as { classroom_id: string }).classroom_id,
    supabase,
  );
}
