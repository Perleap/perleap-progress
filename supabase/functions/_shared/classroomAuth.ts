import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseClient } from '../shared/supabase.ts';
import {
  assertClassroomTeacherOrAdminAccess,
  authFailureToResponse,
  requireAuth,
} from './authorizeResource.ts';

export { shouldAllowClassroomAccess } from './authorizeResource.ts';

export async function assertClassroomTeacherOrAdmin(
  req: Request,
  classroomId: string,
): Promise<{ userId: string; supabase: ReturnType<typeof createClient> } | Response> {
  const auth = await requireAuth(req);
  if ('status' in auth) {
    return authFailureToResponse(auth);
  }

  const access = await assertClassroomTeacherOrAdminAccess(
    auth.user.id,
    classroomId,
    createSupabaseClient(),
  );
  if ('status' in access) {
    return authFailureToResponse(access);
  }

  return { userId: auth.user.id, supabase: access.supabase };
}
