/**
 * Refresh AI evaluations for an entire classroom (5D + CRA + feedback).
 * Async job with student progress, cancel, and commit-at-end (all-or-nothing).
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleOpenAIError } from '../shared/openai.ts';
import { logError } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { assertClassroomTeacherOrAdmin } from '../_shared/classroomAuth.ts';
import {
  getRunningJobForClassroom,
  loadEligibleSubmissions,
  prepareRefreshJob,
  runRefreshJob,
} from '../_shared/evaluationRefreshJob.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

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
    if (!classroomId) {
      return new Response(JSON.stringify({ error: 'classroomId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = await assertClassroomTeacherOrAdmin(req, classroomId);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const running = await getRunningJobForClassroom(supabase, classroomId);
    if (running) {
      return new Response(
        JSON.stringify({ error: 'A refresh is already running for this classroom', jobId: running.id }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const eligibility = await loadEligibleSubmissions(supabase, classroomId);

    if (!eligibility) {
      return new Response(
        JSON.stringify({ batchId: null, updated: 0, skipped: 0, failed: 0, manualSkipped: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { eligible, manualSkipped, skippedNoFeedback } = eligibility;

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({
          batchId: null,
          updated: 0,
          skipped: skippedNoFeedback,
          failed: 0,
          manualSkipped,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { jobId, batchId, totalStudents, totalSubmissions, backups } = await prepareRefreshJob(
      supabase,
      classroomId,
      userId,
      eligible,
    );

    EdgeRuntime.waitUntil(
      runRefreshJob(supabase, jobId, classroomId, eligible, backups, batchId).catch((err) => {
        logError('Background refresh job failed', err);
      }),
    );

    return new Response(
      JSON.stringify({
        jobId,
        totalStudents,
        totalSubmissions,
        manualSkipped,
        skipped: skippedNoFeedback,
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in refresh-class-evaluations', error);
    await persistEdgeFunctionLog(
      {
        functionName: 'refresh-class-evaluations',
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
