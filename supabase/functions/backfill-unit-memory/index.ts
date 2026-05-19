/**
 * Admin batch backfill for student_section_unit_memory.
 * Processes completed submissions missing extraction for their submission_id.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient, isAppAdmin } from '../shared/supabase.ts';
import { extractUnitMemoryFromSubmission } from '../shared/unitMemoryExtract.ts';
import { handleOpenAIError } from '../shared/openai.ts';
import { logError } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createSupabaseClient();
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isAdmin = await isAppAdmin(userData.user.id);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const classroomId = typeof body.classroomId === 'string' ? body.classroomId.trim() : '';
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    const syllabusSectionId =
      typeof body.syllabusSectionId === 'string' ? body.syllabusSectionId.trim() : '';
    const limitRaw = typeof body.limit === 'number' ? body.limit : 50;
    const limit = Math.min(Math.max(1, limitRaw), 200);

    let submissionQuery = supabase
      .from('submissions')
      .select('id, student_id, assignment_id, submitted_at')
      .eq('status', 'completed')
      .eq('is_teacher_attempt', false)
      .order('submitted_at', { ascending: true })
      .limit(limit * 5);

    if (studentId) submissionQuery = submissionQuery.eq('student_id', studentId);

    const { data: subs, error: subsErr } = await submissionQuery;
    if (subsErr) {
      throw new Error(subsErr.message);
    }

    let processed = 0;
    let skipped = 0;
    const errors: { submissionId: string; error: string }[] = [];

    for (const row of subs ?? []) {
      if (processed >= limit) break;

      const { data: assignment, error: aErr } = await supabase
        .from('assignments')
        .select('id, classroom_id, syllabus_section_id')
        .eq('id', row.assignment_id)
        .maybeSingle();

      if (aErr || !assignment?.classroom_id || !assignment?.syllabus_section_id) {
        skipped++;
        continue;
      }
      if (classroomId && assignment.classroom_id !== classroomId) {
        skipped++;
        continue;
      }
      if (syllabusSectionId && assignment.syllabus_section_id !== syllabusSectionId) {
        skipped++;
        continue;
      }

      const result = await extractUnitMemoryFromSubmission(row.id, { skipIfExists: true });
      if (!result.ok) {
        errors.push({ submissionId: row.id, error: result.error ?? 'unknown' });
        continue;
      }
      if (result.skipped) {
        skipped++;
        continue;
      }
      processed++;
    }

    return new Response(
      JSON.stringify({
        processed,
        skipped,
        errors,
        examined: (subs ?? []).length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in backfill-unit-memory', error);
    await persistEdgeFunctionLog({
      functionName: 'backfill-unit-memory',
      level: 'error',
      errorMessage,
      stackSnippet: errorToStack(error),
    }).catch(() => undefined);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
