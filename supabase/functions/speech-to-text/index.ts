import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createTranscription, handleOpenAIError } from '../shared/openai.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('file');
    const language = formData.get('language') as string | undefined;

    if (!audioFile || !(audioFile instanceof Blob)) {
      return new Response(JSON.stringify({ error: 'Audio file is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const opikThreadId = crypto.randomUUID();
    const clientTraceId = uuidv7();
    const traceStartMs = Date.now();
    const text = await createTranscription(audioFile, language);
    const traceEndMs = Date.now();

    void queueOpikTrace({
      traceName: 'speech-to-text.transcription',
      tags: ['speech-to-text', 'edge-function'],
      threadId: opikThreadId,
      clientTraceId,
      traceStartMs,
      traceEndMs,
      input: {
        audio_bytes: audioFile.size,
        language: language ?? undefined,
      },
      output: {
        transcript_chars: text.length,
      },
      metadata: {
        edge_function: 'speech-to-text',
      },
    }).catch(() => undefined);

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('STT Error:', error);
    const message = handleOpenAIError(error);
    await persistEdgeFunctionLog(
      {
        functionName: 'speech-to-text',
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
