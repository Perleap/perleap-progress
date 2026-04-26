import type { FileOptions } from '@supabase/storage-js';

export type StorageUploadProgress = { loaded: number; total: number };

/** Extends SDK `FileOptions` with optional upload progress (runtime support varies by client). */
export type StorageUploadOptions = FileOptions & {
  onUploadProgress?: (progress: StorageUploadProgress) => void;
};
