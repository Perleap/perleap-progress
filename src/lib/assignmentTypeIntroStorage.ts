import { Constants } from '@/integrations/supabase/types';
import type { DbAssignmentType } from '@/types/models';

const VALID_TYPES = new Set<string>(Constants.public.Enums.assignment_type);

function storageKey(userId: string): string {
  return `perleap_assignment_type_intro_v1:${userId}`;
}

export function getSeenAssignmentTypes(userId: string): Set<DbAssignmentType> {
  if (!userId || typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const out = new Set<DbAssignmentType>();
    for (const x of parsed) {
      if (typeof x === 'string' && VALID_TYPES.has(x)) {
        out.add(x as DbAssignmentType);
      }
    }
    return out;
  } catch {
    return new Set();
  }
}

export function markAssignmentTypeIntroSeen(userId: string, type: DbAssignmentType): void {
  if (!userId || typeof window === 'undefined') return;
  if (!VALID_TYPES.has(type)) return;
  try {
    const cur = getSeenAssignmentTypes(userId);
    if (cur.has(type)) return;
    cur.add(type);
    localStorage.setItem(storageKey(userId), JSON.stringify([...cur]));
  } catch {
    // Quota or private mode
  }
}
