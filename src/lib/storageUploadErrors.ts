/** Extract HTTP status from tus-js-client or generic upload errors. */
export function getStorageUploadHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const tus = error as { originalResponse?: { getStatus?: () => number } };
  const status = tus.originalResponse?.getStatus?.();
  return typeof status === 'number' ? status : null;
}

export function isStoragePayloadTooLarge(error: unknown): boolean {
  const status = getStorageUploadHttpStatus(error);
  if (status === 413) return true;
  if (error instanceof Error) {
    return /413|content too large|payload too large|maximum allowed size/i.test(error.message);
  }
  return false;
}

export function getStorageUploadErrorKey(error: unknown): 'globalLimit' | 'generic' {
  return isStoragePayloadTooLarge(error) ? 'globalLimit' : 'generic';
}
