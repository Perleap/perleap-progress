export const MAX_UNKNOWN_COL_STRIPS = 24;

/** PostgREST ~15 returns this text when the JSON body names a column absent from the exposed schema. */
export function unknownPostgrestColumnName(error: unknown): string | null {
  const blobs: string[] = [];
  if (error && typeof error === 'object') {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string') blobs.push(msg);
    try {
      blobs.push(JSON.stringify(error));
    } catch {
      /* ignore */
    }
  } else if (typeof error === 'string') {
    blobs.push(error);
  }
  const patterns = [
    /Could not find the '([^']+)' column /i,
    /Could not find the "([^"]+)" column /i,
  ];
  for (const blob of blobs) {
    for (const re of patterns) {
      const m = blob.match(re);
      if (m?.[1]) return m[1];
    }
  }
  return null;
}

export function stripUnknownColumnFromActivityPayload(
  payload: Record<string, unknown>,
  columnName: string,
): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(payload, columnName)) return payload;
  const next = { ...payload };
  delete next[columnName];
  return next;
}

export async function activityListWriteWithUnknownColumnFallback<T>(
  initialPayload: Record<string, unknown>,
  execute: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: unknown }>,
  emptyPayloadMessage: string,
  exhaustedMessage: string,
): Promise<{ data: T | null; error: unknown }> {
  let mutable = { ...initialPayload };
  const strippedUnknownCols: string[] = [];

  for (let attempt = 0; attempt <= MAX_UNKNOWN_COL_STRIPS + 10; attempt += 1) {
    if (Object.keys(mutable).length === 0) {
      return { data: null, error: { message: emptyPayloadMessage } };
    }

    const { data, error } = await execute(mutable);
    if (!error) return { data, error: null };

    const badCol = unknownPostgrestColumnName(error);
    const canStrip =
      badCol &&
      Object.prototype.hasOwnProperty.call(mutable, badCol) &&
      strippedUnknownCols.length < MAX_UNKNOWN_COL_STRIPS;

    if (!canStrip) {
      return { data: null, error };
    }

    strippedUnknownCols.push(badCol);
    mutable = stripUnknownColumnFromActivityPayload(mutable, badCol);
  }

  return { data: null, error: { message: exhaustedMessage } };
}
