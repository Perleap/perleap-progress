import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getServiceRoleKey, isAppAdmin } from '../shared/supabase.ts';

export async function assertClassroomTeacherOrAdmin(
  req: Request,
  classroomId: string,
): Promise<{ userId: string; supabase: ReturnType<typeof createClient> } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabase = createClient(supabaseUrl, getServiceRoleKey());

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: classroom, error } = await supabase
    .from('classrooms')
    .select('teacher_id')
    .eq('id', classroomId)
    .maybeSingle();

  if (error || !classroom) {
    return new Response(JSON.stringify({ error: 'Classroom not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if ((classroom as { teacher_id: string }).teacher_id !== user.id && !isAppAdmin(user.id)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return { userId: user.id, supabase };
}
