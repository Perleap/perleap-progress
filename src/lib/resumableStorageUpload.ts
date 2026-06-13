import * as tus from 'tus-js-client';
import { supabase } from '@/api/client';
import { isStoragePayloadTooLarge } from '@/lib/storageUploadErrors';

export type UploadProgressCallback = (loaded: number, total: number) => void;

const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

function getResumableEndpoint(): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const match = base.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match?.[1]) {
    throw new Error('Invalid VITE_SUPABASE_URL for resumable uploads');
  }
  return `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable`;
}

export async function uploadFileResumable(
  bucketName: string,
  objectName: string,
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<void> {
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session ?? null;
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: getResumableEndpoint(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session!.access_token}`,
        ...(anonKey ? { apikey: anonKey } : {}),
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName,
        objectName,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: TUS_CHUNK_SIZE,
      onError: (error) => {
        if (isStoragePayloadTooLarge(error)) {
          reject(new Error('STORAGE_GLOBAL_LIMIT_EXCEEDED'));
          return;
        }
        reject(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.(bytesUploaded, bytesTotal);
      },
      onSuccess: () => resolve(),
    });

    void upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]!);
      }
      upload.start();
    });
  });
}

export const TUS_UPLOAD_THRESHOLD_BYTES = TUS_CHUNK_SIZE;
