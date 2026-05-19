import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSpeech, handleOpenAIError } from '../shared/openai.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace } from '../shared/opikTrace.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const voiceUsed = voice || 'shimmer';
    const opikThreadId = crypto.randomUUID();
    const clientTraceId = crypto.randomUUID();
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
