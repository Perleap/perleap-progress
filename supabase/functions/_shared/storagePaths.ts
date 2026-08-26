/**
 * Extract storage object path from raw path or legacy Supabase public/signed URL.
 */
export function extractStorageObjectPath(bucket: string, storedValue: string): string | null {
  const trimmed = storedValue.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed;
  }

  const publicMarker = `/storage/v1/object/public/${bucket}/`;
  const signMarker = `/storage/v1/object/sign/${bucket}/`;
  const marker = trimmed.includes(publicMarker)
    ? publicMarker
    : trimmed.includes(signMarker)
      ? signMarker
      : null;
  if (!marker) return null;

  const idx = trimmed.indexOf(marker);
  return decodeURIComponent(trimmed.slice(idx + marker.length).split('?')[0] ?? '');
}

export const SUBMISSION_FILES_BUCKET = 'submission-files';

export function extractSubmissionStoragePath(stored: string): string | null {
  return extractStorageObjectPath(SUBMISSION_FILES_BUCKET, stored);
}
