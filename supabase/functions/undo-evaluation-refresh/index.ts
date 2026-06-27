/**
 * Undo the latest classroom evaluation refresh batch.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleOpenAIError } from '../shared/openai.ts';
import { logInfo, logError } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import {
  restoreSubmissionBackup,
  type SubmissionEvaluationBackup,
} from '../_shared/evaluationRefreshBackup.ts';
import { assertClassroomTeacherOrAdmin } from '../_shared/classroomAuth.ts';

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
    const { supabase } = auth;

    const { data: batch, error: batchErr } = await supabase
      .from('evaluation_refresh_batches')
      .select('id, backups')
      .eq('classroom_id', classroomId)
      .maybeSingle();

    if (batchErr) {
      logError('Error loading refresh batch', batchErr);
      throw batchErr;
    }

    if (!batch?.backups || !Array.isArray(batch.backups) || batch.backups.length === 0) {
      return new Response(JSON.stringify({ error: 'No refresh batch to undo', restored: 0 }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const backups = batch.backups as SubmissionEvaluationBackup[];
    let restored = 0;
    let failed = 0;

    for (const backup of backups) {
      try {
        await restoreSubmissionBackup(supabase, backup);
        restored++;
      } catch (e) {
        failed++;
        logError(`Undo restore failed for submission ${backup.submission_id}`, e);
      }
    }

    await supabase.from('evaluation_refresh_batches').delete().eq('id', batch.id);

    logInfo('Evaluation refresh undo complete', { classroomId, restored, failed });

    return new Response(
      JSON.stringify({ restored, failed, canUndo: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in undo-evaluation-refresh', error);
    await persistEdgeFunctionLog(
      {
        functionName: 'undo-evaluation-refresh',
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
