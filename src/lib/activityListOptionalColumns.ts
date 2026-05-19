/** Optional activity_list columns that slim DBs / PostgREST may not expose. */
export const ACTIVITY_LIST_OPTIONAL_COLUMNS = new Set([
  'body_text',
  'summary',
  'estimated_duration_minutes',
  'file_path',
  'url',
  'mime_type',
  'file_size',
]);

export function omitOptionalActivityListFields<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const key of ACTIVITY_LIST_OPTIONAL_COLUMNS) {
    delete out[key];
  }
  return out;
}
