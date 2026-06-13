/**
 * Transcribe presentation audio uploaded alongside the video submission.
 * Caches result on submissions.artifact_transcript.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { createTranscription } from '../shared/openai.ts';
import { logInfo } from '../shared/logger.ts';

const SUBMISSION_FILES_BUCKET = 'submission-files';
const PRESENTATION_AUDIO_PATH_SUFFIX = 'presentation-audio.m4a';

function presentationAudioStoragePath(assignmentId: string, submissionId: string): string {
  return `${assignmentId}/${submissionId}/${PRESENTATION_AUDIO_PATH_SUFFIX}`;
}

export async function ensurePresentationTranscript(
  supabase: SupabaseClient,
  submissionId: string,
  assignmentId: string,
  cachedTranscript?: string | null,
  language?: string,
): Promise<string> {
  const trimmed = cachedTranscript?.trim();
  if (trimmed) return trimmed;

  const audioPath = presentationAudioStoragePath(assignmentId, submissionId);
  const { data: blob, error: dlError } = await supabase.storage
    .from(SUBMISSION_FILES_BUCKET)
    .download(audioPath);

  if (dlError || !blob) {
    throw new Error(
      'No presentation audio found for transcription. The student must submit a video with audio.',
    );
  }

  logInfo(`Transcribing presentation audio for submission ${submissionId}`);
  const result = await createTranscription(blob, language);
  const transcript = result.trim();
  if (!transcript) {
    throw new Error('Presentation transcription returned empty text.');
  }

  await supabase
    .from('submissions')
    .update({ artifact_transcript: transcript })
    .eq('id', submissionId);

  return transcript;
}
