import { useEffect, useState } from 'react';
import { peekStorageBlobUrl, resolveStorageStoredValue } from '@/utils/storageUrls';

function readCachedBlobUrl(bucket: string, storedValue: string | null | undefined): string | null {
  if (!storedValue?.trim()) return null;
  const trimmed = storedValue.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
  return peekStorageBlobUrl(bucket, null, trimmed);
}

/** Resolve a private storage path or legacy URL to a session-scoped blob URL. */
export function useAuthenticatedBlobUrl(
  bucket: string,
  storedValue: string | null | undefined,
  enabled = true
) {
  const [blobUrl, setBlobUrl] = useState<string | null>(() =>
    enabled ? readCachedBlobUrl(bucket, storedValue) : null
  );
  const [isLoading, setIsLoading] = useState(() => {
    if (!enabled || !storedValue?.trim()) return false;
    return readCachedBlobUrl(bucket, storedValue) == null;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);

    const trimmed = storedValue?.trim();
    if (!enabled || !trimmed) {
      setBlobUrl(null);
      setIsLoading(false);
      return;
    }

    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
      setBlobUrl(trimmed);
      setIsLoading(false);
      return;
    }

    const cached = readCachedBlobUrl(bucket, trimmed);
    if (cached) {
      setBlobUrl(cached);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      const resolved = await resolveStorageStoredValue(bucket, null, trimmed);
      if (cancelled) return;
      if (!resolved) {
        setError('Failed to load file');
        setBlobUrl(null);
        setIsLoading(false);
        return;
      }
      setBlobUrl(resolved.url);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [bucket, storedValue, enabled]);

  return { blobUrl, isLoading, error };
}
