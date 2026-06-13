/**
 * Transcribe Live Session
 * Processes one audio chunk per request (avoids edge gateway timeouts on long recordings),
 * then a finalize step builds summary + key-moment timestamps.
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  buildFallbackKeyMoments,
  buildSummaryOutline,
  buildSummaryPrompt,
  keyMomentsCoverSession,
  parseKeyMoments,
} from '../shared/liveSessionSummary.ts';
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

function isTranscriptionSegment(item: unknown): item is TranscriptionSegment {
  return (
    typeof item === 'object' &&
    item !== null &&
    'start' in item &&
    'end' in item &&
    'text' in item
  );
}

function parseStoredSegments(timestamps: unknown): TranscriptionSegment[] {
  if (!Array.isArray(timestamps)) return [];
  return timestamps.filter(isTranscriptionSegment);
}

async function generateSummaryAndKeyMoments(
  allSegments: TranscriptionSegment[],
  transcriptText: string,
  sessionEnd: number,
  language: string,
  liveSessionId: string,
): Promise<{ summary: string; timestamps: Array<{ time: number; label: string }> }> {
  const langLabel = language === 'he' ? 'Hebrew' : 'English';
  const { outline } = buildSummaryOutline(allSegments, sessionEnd);
  const summaryPrompt = buildSummaryPrompt(langLabel, sessionEnd);

  let summary = '';
  let timestamps: Array<{ time: number; label: string }> = [];

  const runSummary = async (strictSpread = false) => {
    const prompt = strictSpread
      ? `${summaryPrompt}\n\nIMPORTANT: Your previous attempt did not span the full session. Include moments after the midpoint and in the final third of the ${sessionEnd}s recording.`
      : summaryPrompt;

    const summaryTraceStartMs = Date.now();
    const summaryResult = (await createChatCompletion(
      prompt,
      [{ role: 'user', content: `Timestamped transcript:\n\n${outline}` }],
      0.4,
      1500,
      'smart',
      false,
      'json_object',
    )) as { content: string; usage?: unknown };
    const summaryTraceEndMs = Date.now();
    const parsed = JSON.parse(summaryResult.content);
    const nextSummary = typeof parsed.summary === 'string' ? parsed.summary : '';
    const nextTimestamps = parseKeyMoments(parsed.timestamps, sessionEnd);

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
        session_end_seconds: sessionEnd,
        strict_spread: strictSpread,
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

    return { summary: nextSummary, timestamps: nextTimestamps };
  };

  try {
    const first = await runSummary(false);
    summary = first.summary;
    timestamps = first.timestamps;

    if (!keyMomentsCoverSession(timestamps, sessionEnd)) {
      logInfo('Live session key moments sparse; retrying summary with stricter spread rules');
      const retry = await runSummary(true);
      if (retry.timestamps.length > 0) {
        summary = retry.summary || summary;
        timestamps = retry.timestamps;
      }
    }

    if (!keyMomentsCoverSession(timestamps, sessionEnd)) {
      logInfo('Using fallback evenly-spread key moments for long session');
      const fallback = buildFallbackKeyMoments(allSegments, sessionEnd);
      if (fallback.length > 0) {
        timestamps = fallback;
      }
    }
  } catch (e) {
    logError('Live session summary generation failed', e);
    timestamps = buildFallbackKeyMoments(allSegments, sessionEnd);
  }

  return { summary, timestamps };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let liveSessionId: string | undefined;

  try {
    const body = await req.json();
    liveSessionId = body.liveSessionId;
    const language = body.language ?? 'en';
    const chunkIndex = body.chunkIndex;
    const finalize = body.finalize === true;

    if (!liveSessionId) {
      throw new Error('Missing required field: liveSessionId');
    }

    const supabase = createSupabaseClient();
    const startTime = Date.now();

    const { data: session, error: sessionError } = await supabase
      .from('live_sessions')
      .select('id, audio_chunk_paths, audio_path, transcript, timestamps, duration_seconds')
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

    if (finalize) {
      const allSegments = parseStoredSegments(session.timestamps);
      const transcriptText = typeof session.transcript === 'string' ? session.transcript : '';
      const durationSeconds =
        typeof session.duration_seconds === 'number' ? session.duration_seconds : null;

      const segmentEndMax =
        allSegments.length > 0 ? Math.max(...allSegments.map((s) => s.end)) : 0;
      const sessionEnd =
        durationSeconds && durationSeconds > 0
          ? Math.max(durationSeconds, segmentEndMax)
          : segmentEndMax;

      const { summary, timestamps } = await generateSummaryAndKeyMoments(
        allSegments,
        transcriptText,
        sessionEnd,
        language,
        liveSessionId,
      );

      const { error: updateError } = await supabase
        .from('live_sessions')
        .update({
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

      logInfo(`transcribe-live-session finalize completed in ${Date.now() - startTime}ms`);

      return new Response(
        JSON.stringify({ status: 'ready', segments: allSegments.length, timestamps: timestamps.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (typeof chunkIndex !== 'number' || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new Error('Missing or invalid chunkIndex (use per-chunk requests + finalize)');
    }

    if (chunkIndex >= chunkPaths.length) {
      throw new Error(`chunkIndex ${chunkIndex} out of range (${chunkPaths.length} chunks)`);
    }

    if (chunkIndex === 0) {
      await supabase
        .from('live_sessions')
        .update({
          status: 'transcribing',
          transcript: '',
          timestamps: [],
          summary: null,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', liveSessionId);
    }

    const chunkPath = chunkPaths[chunkIndex];
    const { data: blob, error: dlError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .download(chunkPath);
    if (dlError || !blob) {
      throw new Error(`Failed to download audio chunk ${chunkPath}: ${dlError?.message ?? 'unknown'}`);
    }

    const { data: current, error: currentError } = await supabase
      .from('live_sessions')
      .select('transcript, timestamps')
      .eq('id', liveSessionId)
      .single();

    if (currentError || !current) {
      throw new Error(`Failed to load session state: ${currentError?.message ?? 'unknown'}`);
    }

    const existingSegments = parseStoredSegments(current.timestamps);
    const offset =
      existingSegments.length > 0 ? Math.max(...existingSegments.map((s) => s.end)) : 0;

    const result = await createVerboseTranscription(blob, language);
    const newSegments: TranscriptionSegment[] = result.segments.map((seg) => ({
      start: seg.start + offset,
      end: seg.end + offset,
      text: seg.text,
    }));

    const transcriptText =
      (typeof current.transcript === 'string' ? current.transcript : '') +
      (current.transcript ? '\n' : '') +
      result.text.trim();

    const { error: updateError } = await supabase
      .from('live_sessions')
      .update({
        transcript: transcriptText,
        timestamps: [...existingSegments, ...newSegments],
        status: 'transcribing',
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', liveSessionId);

    if (updateError) {
      throw updateError;
    }

    logInfo(
      `transcribe-live-session chunk ${chunkIndex + 1}/${chunkPaths.length} in ${Date.now() - startTime}ms`,
    );

    return new Response(
      JSON.stringify({
        status: 'transcribing',
        chunkIndex,
        chunkTotal: chunkPaths.length,
        segments: newSegments.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = handleOpenAIError(error);
    logError('Error in transcribe-live-session', error);

    if (liveSessionId) {
      try {
        const supabase = createSupabaseClient();
        await supabase
          .from('live_sessions')
          .update({ status: 'failed', error: message, updated_at: new Date().toISOString() })
          .eq('id', liveSessionId);
      } catch {
        // ignore
      }
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
