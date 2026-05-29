export type TaskUnderstandingChoice = 'yes' | 'no';

function storageKey(userId: string): string {
  return `perleap_task_understanding_v1:${userId}`;
}

function readMap(userId: string): Record<string, TaskUnderstandingChoice> {
  if (!userId || typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, TaskUnderstandingChoice> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && (v === 'yes' || v === 'no')) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function getTaskUnderstandingChoice(
  userId: string,
  submissionId: string,
): TaskUnderstandingChoice | null {
  if (!userId || !submissionId) return null;
  return readMap(userId)[submissionId] ?? null;
}

export function markTaskUnderstanding(
  userId: string,
  submissionId: string,
  choice: TaskUnderstandingChoice,
): void {
  if (!userId || !submissionId || typeof window === 'undefined') return;
  try {
    const map = readMap(userId);
    map[submissionId] = choice;
    localStorage.setItem(storageKey(userId), JSON.stringify(map));
  } catch {
    // Quota or private mode
  }
}
