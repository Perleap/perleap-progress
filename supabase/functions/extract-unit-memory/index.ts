/**
 * Extract unit memory facts from a completed submission and merge into
 * student_section_unit_memory. Idempotent per submission_id.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
    const body = await req.json().catch(() => ({}));
    const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : '';
    if (!submissionId) {
      return new Response(JSON.stringify({ error: 'submissionId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await extractUnitMemoryFromSubmission(submissionId);

    if (!result.ok) {
      return new Response(JSON.stringify(result), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in extract-unit-memory', error);
    await persistEdgeFunctionLog({
      functionName: 'extract-unit-memory',
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
