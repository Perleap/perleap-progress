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
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import {
  assertSubmissionEvaluationAccess,
  authFailureToResponse,
  requireAuth,
} from '../_shared/authorizeResource.ts';
import { checkRateLimit, rateLimitFailureToResponse } from '../_shared/rateLimit.ts';


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireAuth(req);
    if ('status' in auth) {
      return authFailureToResponse(auth, corsHeaders);
    }

    const rateLimit = await checkRateLimit(auth.user.id, 'extract-unit-memory');
    if (rateLimit) {
      return rateLimitFailureToResponse(rateLimit, corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : '';
    if (!submissionId) {
      return new Response(JSON.stringify({ error: 'submissionId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const access = await assertSubmissionEvaluationAccess(auth.user.id, submissionId);
    if ('status' in access) {
      return authFailureToResponse(access, corsHeaders);
    }

    const result = await extractUnitMemoryFromSubmission(access.submissionId);

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
    await persistEdgeFunctionLog(
      {
        functionName: 'extract-unit-memory',
        level: 'error',
        httpStatus: 500,
        message: errorMessage,
        stack: errorToStack(error),
      },
      req,
    ).catch(() => undefined);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
