import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSpeech, handleOpenAIError } from '../shared/openai.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';
import { authFailureToResponse, requireAuth } from '../_shared/authorizeResource.ts';
import { getCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
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

    const rateLimit = await checkRateLimit(auth.user.id, 'text-to-speech');
    if (rateLimit) {
      return rateLimitFailureToResponse(rateLimit, corsHeaders);
    }

    const { text, voice } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const voiceUsed = voice || 'shimmer';
    const opikThreadId = crypto.randomUUID();
    const clientTraceId = uuidv7();
    const traceStartMs = Date.now();
    const response = await createSpeech(text, voiceUsed);
    const traceEndMs = Date.now();

    if (!response.body) {
      throw new Error('No response body from OpenAI');
    }

    // Get the audio data as a Blob
    const audioBlob = await response.blob();

    void queueOpikTrace({
      traceName: 'text-to-speech.synthesis',
      tags: ['text-to-speech', 'edge-function'],
      threadId: opikThreadId,
      clientTraceId,
      traceStartMs,
      traceEndMs,
      input: {
        voice: voiceUsed,
        text_chars: typeof text === 'string' ? text.length : 0,
      },
      output: {
        audio_bytes: audioBlob.size,
        content_type: 'audio/mpeg',
      },
      metadata: {
        edge_function: 'text-to-speech',
      },
    }).catch(() => undefined);

    return new Response(audioBlob, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBlob.size.toString(),
      },
    });
  } catch (error) {
    console.error('TTS Error:', error);
    const message = handleOpenAIError(error);
    await persistEdgeFunctionLog(
      {
        functionName: 'text-to-speech',
        level: 'error',
        httpStatus: 500,
        message,
        stack: errorToStack(error),
      },
      req,
    );
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
