const AVATAR_BUCKETS = new Set(['student-avatars', 'teacher-avatars']);
const AVATAR_DISPLAY_MAX_PX = 256;

const blobUrlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

async function optimizeBlobForDisplay(bucket: string, blob: Blob): Promise<Blob> {
  if (!AVATAR_BUCKETS.has(bucket) || !blob.type.startsWith('image/')) return blob;
  if (typeof createImageBitmap === 'undefined') return blob;

  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(
      AVATAR_DISPLAY_MAX_PX / bitmap.width,
      AVATAR_DISPLAY_MAX_PX / bitmap.height,
      1,
    );
    if (scale >= 1) {
      bitmap.close();
      return blob;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return blob;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const optimized = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    return optimized ?? blob;
  } catch {
    return blob;
  }
}

export function peekCachedBlobUrl(cacheKey: string): string | null {
  return blobUrlCache.get(cacheKey) ?? null;
}

export async function getOrCreateCachedBlobUrl(
  cacheKey: string,
  bucket: string,
  download: () => Promise<Blob | null>,
): Promise<string | null> {
  const cached = blobUrlCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let promise = inflight.get(cacheKey);
  if (!promise) {
    promise = (async () => {
      const blob = await download();
      if (!blob) return null;

      const displayBlob = await optimizeBlobForDisplay(bucket, blob);
      const url = URL.createObjectURL(displayBlob);
      blobUrlCache.set(cacheKey, url);
      return url;
    })().finally(() => {
      inflight.delete(cacheKey);
    });
    inflight.set(cacheKey, promise);
  }

  return promise;
}

export function prefetchCachedBlobUrl(
  cacheKey: string,
  bucket: string,
  download: () => Promise<Blob | null>,
): void {
  void getOrCreateCachedBlobUrl(cacheKey, bucket, download);
}
