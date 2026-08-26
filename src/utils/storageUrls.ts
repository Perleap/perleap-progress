import { supabase } from '@/integrations/supabase/client';
import {
  getOrCreateCachedBlobUrl,
  peekCachedBlobUrl,
  prefetchCachedBlobUrl,
} from '@/utils/authenticatedBlobCache';

export const SYLLABUS_RESOURCES_BUCKET = 'syllabus-resources';
export const SUBMISSION_FILES_BUCKET = 'submission-files';
export const COURSE_MATERIALS_BUCKET = 'course-materials';
export const ASSIGNMENT_MATERIALS_BUCKET = 'assignment-materials';
export const LIVE_SESSION_AUDIO_BUCKET = 'live-session-audio';
export const STUDENT_AVATARS_BUCKET = 'student-avatars';
export const TEACHER_AVATARS_BUCKET = 'teacher-avatars';

export type AuthenticatedBlobUrl = {
  url: string;
  revoke: () => void;
};

/** Extract a storage object path from a raw path or legacy public/signed Supabase URL. */
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

export function isSupabaseStorageUrl(bucket: string, value: string): boolean {
  return extractStorageObjectPath(bucket, value) != null;
}

export async function downloadStorageBlob(bucket: string, path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return null;
  }
  return data;
}

export function getStorageCacheKey(bucket: string, path: string): string {
  return `${bucket}:${path}`;
}

export function peekStorageBlobUrl(
  bucket: string,
  filePath: string | null | undefined,
  storedUrl: string | null | undefined,
): string | null {
  const path =
    filePath?.trim() ||
    (storedUrl?.trim() ? extractStorageObjectPath(bucket, storedUrl.trim()) : null);
  if (!path) return null;
  return peekCachedBlobUrl(getStorageCacheKey(bucket, path));
}

export async function createAuthenticatedBlobUrl(
  bucket: string,
  path: string,
): Promise<AuthenticatedBlobUrl | null> {
  const cacheKey = getStorageCacheKey(bucket, path);
  const url = await getOrCreateCachedBlobUrl(cacheKey, bucket, () =>
    downloadStorageBlob(bucket, path),
  );
  if (!url) return null;
  return { url, revoke: () => {} };
}

export function prefetchStorageBlob(
  bucket: string,
  storedValue: string | null | undefined,
): void {
  const trimmed = storedValue?.trim();
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return;

  const path = extractStorageObjectPath(bucket, trimmed) ?? trimmed;
  prefetchCachedBlobUrl(getStorageCacheKey(bucket, path), bucket, () =>
    downloadStorageBlob(bucket, path),
  );
}

/**
 * Load private storage via authenticated download and return an in-memory blob URL.
 * Blob URLs are scoped to the current browser session and cannot be shared like signed URLs.
 */
export async function resolveStorageStoredValue(
  bucket: string,
  filePath: string | null | undefined,
  storedUrl: string | null | undefined,
): Promise<AuthenticatedBlobUrl | null> {
  const path =
    filePath?.trim() ||
    (storedUrl?.trim() ? extractStorageObjectPath(bucket, storedUrl.trim()) : null);

  if (path) {
    return createAuthenticatedBlobUrl(bucket, path);
  }

  const external = storedUrl?.trim();
  if (
    external &&
    (external.startsWith('http://') || external.startsWith('https://')) &&
    !isSupabaseStorageUrl(bucket, external)
  ) {
    return { url: external, revoke: () => {} };
  }

  return null;
}

export async function resolveSyllabusResourceStoredValue(
  filePath: string | null | undefined,
  storedUrl: string | null | undefined,
): Promise<AuthenticatedBlobUrl | null> {
  return resolveStorageStoredValue(SYLLABUS_RESOURCES_BUCKET, filePath, storedUrl);
}

export function inferAvatarBucket(storedValue: string | null | undefined): string {
  const v = storedValue?.trim() ?? '';
  if (v.includes(`/${STUDENT_AVATARS_BUCKET}/`)) return STUDENT_AVATARS_BUCKET;
  if (v.includes(`/${TEACHER_AVATARS_BUCKET}/`)) return TEACHER_AVATARS_BUCKET;
  return STUDENT_AVATARS_BUCKET;
}

export async function resolveAvatarStoredValue(
  storedValue: string | null | undefined,
  bucket?: string,
): Promise<AuthenticatedBlobUrl | null> {
  if (!storedValue?.trim()) return null;
  const resolvedBucket = bucket ?? inferAvatarBucket(storedValue);
  return resolveStorageStoredValue(resolvedBucket, null, storedValue);
}

export function prefetchAvatarBlob(
  storedValue: string | null | undefined,
  bucket?: string,
): void {
  if (!storedValue?.trim()) return;
  prefetchStorageBlob(bucket ?? inferAvatarBucket(storedValue), storedValue);
}
