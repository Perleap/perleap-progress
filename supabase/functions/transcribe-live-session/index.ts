/**
 * Transcribe Live Session
 * Pulls extracted audio chunks, transcribes each with Whisper (verbose_json for timestamps),
 * stitches a full transcript, then generates a summary + key-moment timestamps via an LLM.
 * Writes everything back to `live_sessions` and flips status to `ready`.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  createChatCompletion,
  createVerboseTranscription,
  handleOpenAIError,
  resolveChatModel,
  type TranscriptionSegment,
} from '../shared/openai.ts';
import { createSupabaseClient } from '../shared/supabase.ts';
import { logInfo, logError } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUDIO_BUCKET = 'live-session-audio';

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { liveSessionId, language = 'en' } = await req.json();
    if (!liveSessionId) {
      throw new Error('Missing required field: liveSessionId');
    }

    const supabase = createSupabaseClient();
    const startTime = Date.now();

    const { data: session, error: sessionError } = await supabase
      .from('live_sessions')
      .select('id, audio_chunk_paths, audio_path')
      .eq('id', liveSessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(`Live session not found: ${sessionError?.message ?? liveSessionId}`);
    }

    const chunkPaths: string[] = Array.isArray(session.audio_chunk_paths)
      ? session.audio_chunk_paths
      : session.audio_path
        ? [session.audio_path]
        : [];

    if (chunkPaths.length === 0) {
      throw new Error('Live session has no extracted audio to transcribe');
    }

    await supabase
      .from('live_sessions')
      .update({ status: 'transcribing', error: null, updated_at: new Date().toISOString() })
      .eq('id', liveSessionId);

    // Transcribe each chunk in order, offsetting timestamps by accumulated duration.
    const allSegments: TranscriptionSegment[] = [];
    let transcriptText = '';
    let offset = 0;

    for (const chunkPath of chunkPaths) {
      const { data: blob, error: dlError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .download(chunkPath);
      if (dlError || !blob) {
        throw new Error(`Failed to download audio chunk ${chunkPath}: ${dlError?.message ?? 'unknown'}`);
      }

      const result = await createVerboseTranscription(blob, language);
      for (const seg of result.segments) {
        allSegments.push({
          start: seg.start + offset,
          end: seg.end + offset,
          text: seg.text,
        });
      }
      transcriptText += (transcriptText ? '\n' : '') + result.text.trim();
      offset += result.duration || (result.segments.at(-1)?.end ?? 0);
    }

    // Build a compact, timestamped outline for the summary model.
    const langLabel = language === 'he' ? 'Hebrew' : 'English';
    const outline = allSegments
      .map((s) => `[${formatTime(s.start)}] ${s.text}`)
      .join('\n')
      .slice(0, 12000);

    const summaryPrompt = `You are summarizing a recorded teaching session for the teacher who ran it.
Using the timestamped transcript, produce a concise summary and a list of key moments.

Respond in ${langLabel} as JSON:
{
  "summary": "A concise 4-8 sentence summary of what happened in the session.",
  "timestamps": [
    { "time": number_of_seconds_from_start, "label": "Short description of this moment" }
  ]
}

Rules:
- Respond in ${langLabel}.
- Pick 5-10 meaningful key moments spread across the session.
- "time" must be an integer number of seconds, taken from the [m:ss] markers in the transcript.
- Keep labels short (a few words).`;

    let summary = '';
    let timestamps: Array<{ time: number; label: string }> = [];
    try {
      const summaryTraceStartMs = Date.now();
      const summaryResult = (await createChatCompletion(
        summaryPrompt,
        [{ role: 'user', content: `Timestamped transcript:\n\n${outline}` }],
        0.4,
        1500,
        'smart',
        false,
        'json_object',
      )) as { content: string; usage?: unknown };
      const summaryTraceEndMs = Date.now();
      const parsed = JSON.parse(summaryResult.content);
      summary = typeof parsed.summary === 'string' ? parsed.summary : '';
      if (Array.isArray(parsed.timestamps)) {
        timestamps = parsed.timestamps
          .filter((tp: unknown) => tp && typeof tp === 'object')
          .map((tp: { time?: unknown; label?: unknown }) => ({
            time: Math.max(0, Math.floor(Number(tp.time) || 0)),
            label: String(tp.label ?? '').trim(),
          }))
          .filter((tp: { label: string }) => tp.label.length > 0);
      }

      void queueOpikTrace({
        traceName: 'transcribe-live-session.summary',
        tags: ['transcribe-live-session', 'edge-function'],
        threadId: liveSessionId,
        clientTraceId: uuidv7(),
        traceStartMs: summaryTraceStartMs,
        traceEndMs: summaryTraceEndMs,
        input: {
          language,
          transcript_chars: transcriptText.length,
          segment_count: allSegments.length,
        },
        output: { raw_json: summaryResult.content },
        openaiUsage: summaryResult.usage,
        llmModel: resolveChatModel('smart'),
        metadata: {
          edge_function: 'transcribe-live-session',
          model_tier: 'smart',
          live_session_id: liveSessionId,
        },
      }).catch(() => undefined);
    } catch (e) {
      logError('Live session summary generation failed', e);
    }

    const { error: updateError } = await supabase
      .from('live_sessions')
      .update({
        transcript: transcriptText,
        summary,
        timestamps,
        status: 'ready',
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', liveSessionId);

    if (updateError) {
      throw updateError;
    }

    logInfo(`transcribe-live-session completed in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({ status: 'ready', segments: allSegments.length, timestamps: timestamps.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = handleOpenAIError(error);
    logError('Error in transcribe-live-session', error);

    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.liveSessionId) {
        const supabase = createSupabaseClient();
        await supabase
          .from('live_sessions')
          .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
          .eq('id', body.liveSessionId);
      }
    } catch {
      // ignore
    }

    await persistEdgeFunctionLog(
      {
        functionName: 'transcribe-live-session',
        level: 'error',
        httpStatus: 500,
        message,
        stack: errorToStack(error),
      },
      req,
    );

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
