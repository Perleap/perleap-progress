/**

 * In-browser video → audio extraction for live sessions (ffmpeg.wasm).

 * Lazy-loaded so the main bundle stays small. Chunks output under Whisper's 25 MB limit.

 */

import { FFmpeg } from '@ffmpeg/ffmpeg';

import { fetchFile, toBlobURL } from '@ffmpeg/util';

/** Match installed @ffmpeg/ffmpeg (worker must load sibling ESM modules from the same CDN path). */
const FFMPEG_VERSION = '0.12.15';

/** Match @ffmpeg/ffmpeg bundled core version (see node_modules/@ffmpeg/ffmpeg/dist/esm/const.js). */
const FFMPEG_CORE_VERSION = '0.12.9';

const FFMPEG_ESM_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm`;
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

/** Keep chunks comfortably below the 25 MB Whisper limit. */

export const WHISPER_MAX_CHUNK_BYTES = 24 * 1024 * 1024;

const AUDIO_BITRATE = '64k';

const CHUNK_SECONDS = Math.floor((WHISPER_MAX_CHUNK_BYTES * 8) / (64 * 1000));

export type ExtractProgress = {
  phase: 'loading' | 'writing' | 'converting' | 'chunking';

  ratio: number;
};

let ffmpegInstance: FFmpeg | null = null;

let loadPromise: Promise<FFmpeg> | null = null;

let ffmpegReady = false;

/** Map ffmpeg extraction phases to 0–100 for the create-dialog progress bar. */

export function mapExtractProgressToPercent(p: ExtractProgress): number {
  const phaseStart: Record<ExtractProgress['phase'], number> = {
    loading: 0,

    writing: 12,

    converting: 20,

    chunking: 92,
  };

  const phaseEnd: Record<ExtractProgress['phase'], number> = {
    loading: 12,

    writing: 20,

    converting: 92,

    chunking: 100,
  };

  const start = phaseStart[p.phase];

  const end = phaseEnd[p.phase];

  const ratio = Math.min(1, Math.max(0, p.ratio));

  return Math.min(100, Math.max(0, Math.round(start + (end - start) * ratio)));
}

function resetFfmpegLoadState(): void {
  loadPromise = null;

  ffmpegInstance = null;

  ffmpegReady = false;
}

async function getFfmpeg(onProgress?: (p: ExtractProgress) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegReady) return ffmpegInstance;

  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    onProgress?.({ phase: 'loading', ratio: 0 });

    const ffmpeg = new FFmpeg();

    ffmpeg.on('progress', ({ progress }) => {
      if (progress > 0 && progress <= 1) {
        onProgress?.({ phase: 'converting', ratio: progress });
      }
    });

    try {
      const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript');

      const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');

      // Load worker from CDN so sibling imports (const.js, errors.js) resolve; Vite ?url emits
      // an unbundled ESM worker that 404s on /assets/const.js in SPA deployments.
      const classWorkerURL = `${FFMPEG_ESM_BASE}/worker.js`;

      // #region agent log
      fetch('http://127.0.0.1:7500/ingest/ed854b70-ad07-4d4d-a108-a3423d664607', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '83200d' },
        body: JSON.stringify({
          sessionId: '83200d',
          runId: 'post-fix',
          hypothesisId: 'A',
          location: 'liveSessionExtractAudio.ts:getFfmpeg',
          message: 'ffmpeg worker URL before load',
          data: { classWorkerURL, bundledConstProbe: `${window.location.origin}/assets/const.js` },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      fetch(`${window.location.origin}/assets/const.js`)
        .then(async (res) => {
          fetch('http://127.0.0.1:7500/ingest/ed854b70-ad07-4d4d-a108-a3423d664607', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '83200d' },
            body: JSON.stringify({
              sessionId: '83200d',
              runId: 'post-fix',
              hypothesisId: 'B',
              location: 'liveSessionExtractAudio.ts:getFfmpeg',
              message: 'bundled /assets/const.js probe',
              data: {
                status: res.status,
                contentType: res.headers.get('content-type'),
                isHtml: (res.headers.get('content-type') ?? '').includes('text/html'),
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        })
        .catch(() => {});
      // #endregion

      await ffmpeg.load({
        coreURL,

        wasmURL,

        classWorkerURL,
      });

      // #region agent log
      fetch('http://127.0.0.1:7500/ingest/ed854b70-ad07-4d4d-a108-a3423d664607', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '83200d' },
        body: JSON.stringify({
          sessionId: '83200d',
          runId: 'post-fix',
          hypothesisId: 'C',
          location: 'liveSessionExtractAudio.ts:getFfmpeg',
          message: 'ffmpeg.load succeeded',
          data: { loaded: ffmpeg.loaded },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7500/ingest/ed854b70-ad07-4d4d-a108-a3423d664607', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '83200d' },
        body: JSON.stringify({
          sessionId: '83200d',
          runId: 'post-fix',
          hypothesisId: 'C',
          location: 'liveSessionExtractAudio.ts:getFfmpeg',
          message: 'ffmpeg.load failed',
          data: { error: err instanceof Error ? err.message : String(err) },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      resetFfmpegLoadState();

      throw err;
    }

    onProgress?.({ phase: 'loading', ratio: 1 });

    ffmpegInstance = ffmpeg;

    ffmpegReady = true;

    return ffmpeg;
  })();

  return loadPromise;
}

function blobFromFfmpegFile(data: Uint8Array | string): Blob {
  if (typeof data === 'string') return new Blob([], { type: 'audio/mp4' });

  return new Blob([data], { type: 'audio/mp4' });
}

async function splitAudioIfNeeded(
  ffmpeg: FFmpeg,

  inputName: string,

  onProgress?: (p: ExtractProgress) => void
): Promise<Blob[]> {
  const audioData = await ffmpeg.readFile(inputName);

  const single = blobFromFfmpegFile(audioData as Uint8Array);

  if (single.size <= WHISPER_MAX_CHUNK_BYTES) {
    await ffmpeg.deleteFile(inputName);

    return [single];
  }

  onProgress?.({ phase: 'chunking', ratio: 0 });

  const segmentPattern = 'chunk%03d.m4a';

  await ffmpeg.exec([
    '-i',

    inputName,

    '-acodec',

    'copy',

    '-f',

    'segment',

    '-segment_time',

    String(CHUNK_SECONDS),

    '-reset_timestamps',

    '1',

    segmentPattern,
  ]);

  const blobs: Blob[] = [];

  for (let i = 0; i < 999; i++) {
    const name = `chunk${String(i).padStart(3, '0')}.m4a`;

    try {
      const chunkData = await ffmpeg.readFile(name);

      blobs.push(blobFromFfmpegFile(chunkData as Uint8Array));

      await ffmpeg.deleteFile(name);

      onProgress?.({ phase: 'chunking', ratio: Math.min(1, (i + 1) / 10) });
    } catch {
      break;
    }
  }

  await ffmpeg.deleteFile(inputName);

  onProgress?.({ phase: 'chunking', ratio: 1 });

  return blobs.length > 0 ? blobs : [single];
}

/**

 * Quick metadata for soft warnings (no ffmpeg). Returns null if not a video or unreadable.

 */

function releaseVideoProbeElement(video: HTMLVideoElement, objectUrl: string): void {
  video.onloadedmetadata = null;
  video.onerror = null;
  video.removeAttribute('src');
  video.load();
  URL.revokeObjectURL(objectUrl);
}

/**
 * Read video duration for warnings. Uses a blob URL; in-flight range requests may show
 * as "canceled" in DevTools when the probe is aborted or the file changes — expected.
 */
export async function probeVideoFileForWarning(
  file: File,
  signal?: AbortSignal
): Promise<{ durationSeconds: number; fileSizeMb: number } | null> {
  if (!file.type.startsWith('video/')) return null;

  const fileSizeMb = file.size / (1024 * 1024);

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const finish = (result: { durationSeconds: number; fileSizeMb: number } | null) => {
      releaseVideoProbeElement(video, url);
      resolve(result);
    };

    const onAbort = () => finish(null);
    signal?.addEventListener('abort', onAbort, { once: true });

    video.onloadedmetadata = () => {
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) {
        finish(null);
        return;
      }
      finish({
        durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
        fileSizeMb,
      });
    };

    video.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      finish({ durationSeconds: 0, fileSizeMb });
    };

    video.src = url;
  });
}

export function shouldShowLongRecordingWarning(meta: {
  durationSeconds: number;

  fileSizeMb: number;
}): boolean {
  return meta.fileSizeMb > 200 || meta.durationSeconds > 60 * 60;
}

/**

 * Extract mono compressed audio from a video file and chunk for Whisper if needed.

 */

export async function extractAudioFromVideo(
  file: File,
  onProgress?: (p: ExtractProgress) => void,
  knownDurationSeconds?: number
): Promise<{ blobs: Blob[]; durationSeconds: number }> {
  const ffmpeg = await getFfmpeg(onProgress);

  const inputName = `input.${file.name.split('.').pop() || 'mp4'}`;

  onProgress?.({ phase: 'writing', ratio: 0 });

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  onProgress?.({ phase: 'writing', ratio: 1 });

  const durationSeconds =
    knownDurationSeconds && knownDurationSeconds > 0
      ? knownDurationSeconds
      : ((await probeVideoFileForWarning(file))?.durationSeconds ?? 0);

  onProgress?.({ phase: 'converting', ratio: 0 });

  const outputName = 'audio.m4a';

  await ffmpeg.exec(['-i', inputName, '-vn', '-ac', '1', '-b:a', AUDIO_BITRATE, outputName]);

  await ffmpeg.deleteFile(inputName);

  const blobs = await splitAudioIfNeeded(ffmpeg, outputName, onProgress);

  return { blobs, durationSeconds };
}

/**

 * Prepare audio blob(s) for upload: pass-through small audio, or chunk large audio via ffmpeg.

 */

export async function prepareAudioBlobsForUpload(
  file: File,
  mode: 'video' | 'audio',
  onProgress?: (p: ExtractProgress) => void,
  options?: { knownDurationSeconds?: number }
): Promise<{ blobs: Blob[]; durationSeconds: number }> {
  if (mode === 'video') {
    return extractAudioFromVideo(file, onProgress, options?.knownDurationSeconds);
  }

  if (file.size <= WHISPER_MAX_CHUNK_BYTES) {
    return { blobs: [file], durationSeconds: 0 };
  }

  const ffmpeg = await getFfmpeg(onProgress);

  const inputName = `input.${file.name.split('.').pop() || 'm4a'}`;

  onProgress?.({ phase: 'writing', ratio: 0 });

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  onProgress?.({ phase: 'writing', ratio: 1 });

  const blobs = await splitAudioIfNeeded(ffmpeg, inputName, onProgress);

  return { blobs, durationSeconds: 0 };
}
