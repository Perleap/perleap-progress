import type { ReleaseMode } from '@/types/syllabus';

/** Legacy DB value no longer exposed in the app; treat as all-at-once for unlock behavior. */
const LEGACY_PREREQUISITES_MODE = 'prerequisites';

/**
 * Maps stored `release_mode` strings to the supported `ReleaseMode` union.
 * Old syllabi may still have `prerequisites` in the database.
 */
export function normalizeReleaseMode(mode: string | null | undefined): ReleaseMode {
  if (mode === LEGACY_PREREQUISITES_MODE) return 'all_at_once';
  if (
    mode === 'all_at_once' ||
    mode === 'sequential' ||
    mode === 'date_based' ||
    mode === 'manual'
  ) {
    return mode;
  }
  return 'all_at_once';
}
