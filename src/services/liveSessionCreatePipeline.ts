import {
  mapExtractProgressToPercent,
  prepareAudioBlobsForUpload,
  type ExtractProgress,
} from '@/lib/liveSessionExtractAudio';
import type { LiveSessionType, LiveSessionUploadMode } from '@/types/liveSession';
import {
  createLiveSession,
  startLiveSessionTranscriptionWithProgress,
  uploadLiveSessionAudio,
  type TranscriptionProgressUpdate,
} from './liveSessionService';

export type LiveSessionPipelineProgress = {
  percent: number;
  phase: 'creating' | 'converting' | 'preparing' | 'uploading' | 'transcribing' | 'summarizing' | 'finishing';
  transcriptionPhase?: TranscriptionProgressUpdate['phase'];
  chunkIndex?: number;
  chunkTotal?: number;
};

export type RunLiveSessionCreatePipelineInput = {
  classroomId: string;
  syllabusSectionId?: string | null;
  title: string;
  sessionType: LiveSessionType;
  file: File;
  uploadMode: LiveSessionUploadMode;
  language: 'en' | 'he';
  knownDurationSeconds?: number;
  onProgress?: (update: LiveSessionPipelineProgress) => void;
  onAssignmentCreated?: (assignmentId: string) => void;
};

export type RunLiveSessionCreatePipelineResult =
  | { assignmentId: string; liveSessionId: string }
  | { error: string; conversionError?: boolean };

export async function runLiveSessionCreatePipeline(
  input: RunLiveSessionCreatePipelineInput
): Promise<RunLiveSessionCreatePipelineResult> {
  const report = (update: LiveSessionPipelineProgress) => {
    input.onProgress?.(update);
  };

  report({ percent: 3, phase: 'creating' });

  const created = await createLiveSession({
    classroomId: input.classroomId,
    syllabusSectionId: input.syllabusSectionId ?? null,
    title: input.title.trim(),
    sessionType: input.sessionType,
  });

  if ('error' in created) {
    return { error: created.error.message };
  }

  input.onAssignmentCreated?.(created.assignmentId);

  let blobs: Blob[];
  let playbackBlob: Blob;
  let durationSeconds: number | null = null;

  if (input.uploadMode === 'video') {
    report({ percent: 5, phase: 'converting' });
    const extracted = await prepareAudioBlobsForUpload(
      input.file,
      'video',
      (p: ExtractProgress) => {
        const extractPct = mapExtractProgressToPercent(p);
        report({ percent: 5 + extractPct * 0.7, phase: 'converting' });
      },
      { knownDurationSeconds: input.knownDurationSeconds }
    );
    blobs = extracted.blobs;
    playbackBlob = extracted.playbackBlob;
    durationSeconds = extracted.durationSeconds > 0 ? extracted.durationSeconds : null;
  } else {
    report({ percent: 10, phase: 'preparing' });
    const prepared = await prepareAudioBlobsForUpload(input.file, 'audio', (p: ExtractProgress) => {
      const extractPct = mapExtractProgressToPercent(p);
      report({ percent: 5 + extractPct * 0.7, phase: 'preparing' });
    });
    blobs = prepared.blobs;
    playbackBlob = prepared.playbackBlob;
    durationSeconds = prepared.durationSeconds > 0 ? prepared.durationSeconds : null;
  }

  report({ percent: 82, phase: 'uploading' });

  const uploaded = await uploadLiveSessionAudio(
    created.liveSessionId,
    blobs,
    durationSeconds,
    playbackBlob
  );

  if ('error' in uploaded) {
    return { error: uploaded.error.message };
  }

  const { error: transcribeError } = await startLiveSessionTranscriptionWithProgress(
    created.liveSessionId,
    input.language,
    {
      audioChunkCount: uploaded.audioChunkPaths.length,
      durationSeconds,
      onProgress: (update) => {
        const phase =
          update.phase === 'transcribing'
            ? 'transcribing'
            : update.phase === 'summarizing'
              ? 'summarizing'
              : 'finishing';
        report({
          percent: update.percent,
          phase,
          transcriptionPhase: update.phase,
          chunkIndex: update.chunkIndex,
          chunkTotal: update.chunkTotal,
        });
      },
    }
  );

  if (transcribeError) {
    const message = transcribeError.message;
    const conversionError =
      message.toLowerCase().includes('ffmpeg') || message.toLowerCase().includes('load');
    return { error: message, conversionError };
  }

  report({ percent: 100, phase: 'finishing', transcriptionPhase: 'finishing' });

  return { assignmentId: created.assignmentId, liveSessionId: created.liveSessionId };
}
