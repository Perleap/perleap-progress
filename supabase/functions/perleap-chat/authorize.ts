import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import {
  createSupabaseClient,
  isAppAdmin,
} from '../shared/supabase.ts';

export type AuthorizedPerleapChatSession = {
  user: { id: string };
  learnerUserId: string;
  assignmentId: string;
};

export type AuthFailure = { status: 401 | 403 | 404; body: string };

/**
 * Validates JWT + that the submission exists and callers may act on behalf of its learner profile.
 */
export async function authorizePerleapChat(
  req: Request,
  submissionIdRaw: string,
  assignmentIdRaw: string,
): Promise<AuthorizedPerleapChatSession | AuthFailure> {
  const submissionId = typeof submissionIdRaw === 'string' ? submissionIdRaw.trim() : '';
  const assignmentIdFromBody = typeof assignmentIdRaw === 'string' ? assignmentIdRaw.trim() : '';

  if (!submissionId || !assignmentIdFromBody) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Missing submissionId or assignmentId.' }),
    };
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      status: 401,
      body: JSON.stringify({ error: 'Missing or invalid Authorization header.' }),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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

  const supabase = createSupabaseClient();
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

  if (submission.assignment_id !== assignmentIdFromBody) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Assignment does not match this submission.' }),
    };
  }

  const learnerUserId = submission.student_id as string;
  const viewerIsOwner = submission.student_id === user.id;
  const viewerIsAdmin = !viewerIsOwner && (await isAppAdmin(user.id));

  if (!viewerIsOwner && !viewerIsAdmin) {
    return {
      status: 403,
      body: JSON.stringify({ error: 'Forbidden' }),
    };
  }

  return {
    user,
    learnerUserId,
    assignmentId: submission.assignment_id as string,
  };
}
