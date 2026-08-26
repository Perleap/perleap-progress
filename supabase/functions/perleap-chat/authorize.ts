import {
  assertSubmissionAccess,
  type AuthFailure,
  requireAuth,
} from '../_shared/authorizeResource.ts';

export type AuthorizedPerleapChatSession = {
  user: { id: string };
  learnerUserId: string;
  assignmentId: string;
};

export type { AuthFailure };

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

  const auth = await requireAuth(req);
  if ('status' in auth) {
    return auth;
  }

  const access = await assertSubmissionAccess(auth.user.id, submissionId, assignmentIdFromBody);
  if ('status' in access) {
    return access;
  }

  return {
    user: access.user,
    learnerUserId: access.learnerUserId,
    assignmentId: access.assignmentId,
  };
}
