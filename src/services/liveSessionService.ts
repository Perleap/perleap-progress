/**
 * Live Session Service
 * Create/read live sessions, upload audio, and run transcription via edge functions.
 *
 * Flow: createAssignment(type=live_session) -> create live_sessions row ->
 * browser extracts audio (video) or pass-through (audio) -> upload to live-session-audio ->
 * transcribe-live-session edge fn fills transcript/summary/timestamps.
 */

import { supabase, handleSupabaseError } from '@/api/client';
import { createAssignment } from './assignmentService';
import type { ApiError } from '@/types';
import type { LiveSession, LiveSessionType } from '@/types/liveSession';

const AUDIO_BUCKET = 'live-session-audio';

function rowToLiveSession(row: Record<string, unknown>): LiveSession {
  return {
    id: row.id as string,
    assignment_id: row.assignment_id as string,
    classroom_id: row.classroom_id as string,
    syllabus_section_id: (row.syllabus_section_id as string | null) ?? null,
    session_type: (row.session_type as LiveSessionType) ?? 'workshop',
    status: (row.status as LiveSession['status']) ?? 'uploaded',
    video_temp_path: (row.video_temp_path as string | null) ?? null,
    audio_path: (row.audio_path as string | null) ?? null,
    audio_chunk_paths: Array.isArray(row.audio_chunk_paths)
      ? (row.audio_chunk_paths as string[])
      : [],
    duration_seconds: (row.duration_seconds as number | null) ?? null,
    transcript: (row.transcript as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    timestamps: Array.isArray(row.timestamps) ? (row.timestamps as LiveSession['timestamps']) : [],
    error: (row.error as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * Create the assignment + live_sessions row. Returns the new assignmentId (also the flow step id).
 */
export const createLiveSession = async (input: {
  classroomId: string;
  syllabusSectionId?: string | null;
  title: string;
  sessionType: LiveSessionType;
}): Promise<{ assignmentId: string; liveSessionId: string } | { error: ApiError }> => {
  const { data: assignment, error: assignErr } = await createAssignment({
    classroom_id: input.classroomId,
    title: input.title,
    instructions: `Live session (${input.sessionType}). Teacher evaluates students from the recording.`,
    type: 'live_session',
    status: 'published',
    due_at: null,
    target_dimensions: {
      vision: false,
      values: false,
      thinking: false,
      connection: false,
      action: false,
    },
    personalization_flag: false,
  });

  if (assignErr || !assignment) {
    return { error: assignErr ?? handleSupabaseError(new Error('Assignment create failed')) };
  }

  if (input.syllabusSectionId) {
    await supabase
      .from('assignments')
      .update({ syllabus_section_id: input.syllabusSectionId })
      .eq('id', assignment.id);
  }

  const { data: row, error: rowErr } = await supabase
    .from('live_sessions')
    .insert({
      assignment_id: assignment.id,
      classroom_id: input.classroomId,
      syllabus_section_id: input.syllabusSectionId ?? null,
      session_type: input.sessionType,
      status: 'uploaded',
    })
    .select()
    .single();

  if (rowErr || !row) {
    return { error: handleSupabaseError(rowErr ?? new Error('live_sessions insert failed')) };
  }

  return { assignmentId: assignment.id, liveSessionId: (row as { id: string }).id };
};

/**
 * Upload prepared audio chunk(s) and mark the session ready for transcription.
 */
export const uploadLiveSessionAudio = async (
  liveSessionId: string,
  blobs: Blob[],
  durationSeconds: number | null = null
): Promise<{ audioChunkPaths: string[] } | { error: ApiError }> => {
  const uploadedChunkPaths: string[] = [];

  for (let i = 0; i < blobs.length; i++) {
    const storageKey = `${liveSessionId}/chunk-${String(i).padStart(3, '0')}.m4a`;
    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(storageKey, blobs[i], { upsert: true, contentType: 'audio/mp4' });

    if (uploadError) {
      return { error: handleSupabaseError(uploadError) };
    }
    uploadedChunkPaths.push(storageKey);
  }

  const { error: updateError } = await supabase
    .from('live_sessions')
    .update({
      audio_path: uploadedChunkPaths[0] ?? null,
      audio_chunk_paths: uploadedChunkPaths,
      duration_seconds: durationSeconds ?? null,
      video_temp_path: null,
      status: 'extracted',
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', liveSessionId);

  if (updateError) {
    return { error: handleSupabaseError(updateError) };
  }

  return { audioChunkPaths: uploadedChunkPaths };
};

/**
 * Run transcription + summary (Whisper + LLM) via edge function.
 */
export const startLiveSessionTranscription = async (
  liveSessionId: string,
  language: 'en' | 'he' = 'en'
): Promise<{ error: ApiError | null }> => {
  const { error } = await supabase.functions.invoke('transcribe-live-session', {
    body: { liveSessionId, language },
  });
  return { error: error ? handleSupabaseError(error) : null };
};

export type TranscriptionProgressUpdate = {
  percent: number;
  phase: 'transcribing' | 'summarizing' | 'finishing';
  chunkIndex?: number;
  chunkTotal?: number;
};

/**
 * Await transcription while reporting estimated progress (edge fn has no streaming updates).
 */
export const startLiveSessionTranscriptionWithProgress = async (
  liveSessionId: string,
  language: 'en' | 'he',
  options: {
    audioChunkCount: number;
    durationSeconds: number | null;
    onProgress: (update: TranscriptionProgressUpdate) => void;
  }
): Promise<{ error: ApiError | null }> => {
  const chunkTotal = Math.max(1, options.audioChunkCount);
  const duration =
    options.durationSeconds && options.durationSeconds > 0 ? options.durationSeconds : 600;
  const estimatedMs = Math.max(45_000, duration * 350 + chunkTotal * 40_000);

  let stopped = false;
  const startedAt = Date.now();

  const tick = () => {
    if (stopped) return;
    const elapsed = Date.now() - startedAt;
    const ratio = Math.min(0.97, elapsed / estimatedMs);
    const transcribePortion = 0.82;
    if (ratio < transcribePortion) {
      const chunkRatio = ratio / transcribePortion;
      const chunkIndex = Math.min(chunkTotal, Math.max(1, Math.ceil(chunkRatio * chunkTotal)));
      options.onProgress({
        percent: Math.round(88 + ratio * 9),
        phase: 'transcribing',
        chunkIndex,
        chunkTotal,
      });
      return;
    }
    if (ratio < 0.94) {
      options.onProgress({
        percent: Math.round(97 + (ratio - transcribePortion) * 20),
        phase: 'summarizing',
      });
      return;
    }
    options.onProgress({ percent: 99, phase: 'finishing' });
  };

  const intervalId = window.setInterval(tick, 450);
  tick();

  try {
    const result = await startLiveSessionTranscription(liveSessionId, language);
    if (!result.error) {
      options.onProgress({ percent: 100, phase: 'finishing' });
    }
    return result;
  } finally {
    stopped = true;
    window.clearInterval(intervalId);
  }
};

/** @deprecated Use startLiveSessionTranscription */
export const startLiveSessionProcessing = startLiveSessionTranscription;

export const getLiveSessionByAssignment = async (
  assignmentId: string
): Promise<{ data: LiveSession | null; error: ApiError | null }> => {
  const { data, error } = await supabase
    .from('live_sessions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  if (error) return { data: null, error: handleSupabaseError(error) };
  return { data: data ? rowToLiveSession(data as Record<string, unknown>) : null, error: null };
};

export const getLiveSessionAudioUrl = async (audioPath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(audioPath, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
};

export interface StudentEvaluationState {
  submissionId: string | null;
  evaluated: boolean;
}

export const getLiveSessionEvaluationStates = async (
  assignmentId: string
): Promise<{ data: Record<string, StudentEvaluationState>; error: ApiError | null }> => {
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('id, student_id, assignment_feedback(id)')
    .eq('assignment_id', assignmentId);

  if (error) return { data: {}, error: handleSupabaseError(error) };

  const map: Record<string, StudentEvaluationState> = {};
  for (const sub of (submissions ?? []) as Array<{
    id: string;
    student_id: string;
    assignment_feedback: Array<{ id: string }> | null;
  }>) {
    const evaluated = Array.isArray(sub.assignment_feedback) && sub.assignment_feedback.length > 0;
    const existing = map[sub.student_id];
    if (!existing || (evaluated && !existing.evaluated)) {
      map[sub.student_id] = { submissionId: sub.id, evaluated };
    }
  }
  return { data: map, error: null };
};

export const ensureStudentEvaluationSubmission = async (
  assignmentId: string,
  studentId: string
): Promise<{ submissionId: string } | { error: ApiError }> => {
  const { data: existing, error: existingError } = await supabase
    .from('submissions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) return { error: handleSupabaseError(existingError) };
  if (existing?.id) return { submissionId: existing.id };

  const { data: created, error: createError } = await supabase
    .from('submissions')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      attempt_number: 1,
      status: 'completed',
    })
    .select('id')
    .single();

  if (createError || !created) {
    return { error: handleSupabaseError(createError ?? new Error('submission insert failed')) };
  }
  return { submissionId: (created as { id: string }).id };
};
