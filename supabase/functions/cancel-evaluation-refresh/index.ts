/**
 * Cancel a running classroom evaluation refresh job.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleOpenAIError } from '../shared/openai.ts';
import { logInfo, logError } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { assertClassroomTeacherOrAdmin } from '../_shared/classroomAuth.ts';
import { cancelRefreshJob, getRunningJobForClassroom } from '../_shared/evaluationRefreshJob.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const classroomId = typeof body.classroomId === 'string' ? body.classroomId.trim() : '';
    let jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';

    if (!classroomId) {
      return new Response(JSON.stringify({ error: 'classroomId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = await assertClassroomTeacherOrAdmin(req, classroomId);
    if (auth instanceof Response) return auth;
    const { supabase } = auth;

    if (!jobId) {
      const running = await getRunningJobForClassroom(supabase, classroomId);
      if (!running) {
        return new Response(JSON.stringify({ cancelled: false, error: 'No running job' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      jobId = running.id;
    }

    const cancelled = await cancelRefreshJob(supabase, jobId, classroomId);

    if (!cancelled) {
      return new Response(JSON.stringify({ cancelled: false, error: 'Job not running' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logInfo('Evaluation refresh cancel requested', { classroomId, jobId });

    return new Response(JSON.stringify({ cancelled: true, jobId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in cancel-evaluation-refresh', error);
    await persistEdgeFunctionLog(
      {
        functionName: 'cancel-evaluation-refresh',
        level: 'error',
        httpStatus: 500,
        message: errorMessage,
        stack: errorToStack(error),
      },
      req,
    );
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
