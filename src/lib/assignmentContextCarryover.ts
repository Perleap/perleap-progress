const STORAGE_KEY_V2 = 'perleap_assignment_context_carryover_v2';
/** Legacy single-slot storage (pre–whole-unit chain). */
const STORAGE_KEY_V1 = 'perleap_assignment_context_carryover_v1';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CHAIN_ENTRIES = 15;

export type CarriedAssignmentEntry = {
  priorSubmissionId: string;
  priorAssignmentId: string;
  at: number;
};

export type AssignmentContextCarryoverV2 = {
  v: 2;
  studentId: string;
  classroomId: string;
  chain: CarriedAssignmentEntry[];
};

/** @deprecated v1 shape — migrated on read */
type AssignmentContextCarryoverV1 = {
  priorSubmissionId: string;
  priorAssignmentId: string;
  classroomId: string;
  studentId: string;
  at: number;
};

function parseV2(raw: string): AssignmentContextCarryoverV2 | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AssignmentContextCarryoverV2>;
    if (
      parsed.v !== 2 ||
      typeof parsed.studentId !== 'string' ||
      typeof parsed.classroomId !== 'string' ||
      !Array.isArray(parsed.chain)
    ) {
      return null;
    }
    const chain: CarriedAssignmentEntry[] = [];
    for (const e of parsed.chain) {
      if (
        e &&
        typeof e.priorSubmissionId === 'string' &&
        typeof e.priorAssignmentId === 'string' &&
        typeof e.at === 'number'
      ) {
        chain.push({
          priorSubmissionId: e.priorSubmissionId,
          priorAssignmentId: e.priorAssignmentId,
          at: e.at,
        });
      }
    }
    return { v: 2, studentId: parsed.studentId, classroomId: parsed.classroomId, chain };
  } catch {
    return null;
  }
}

function tryMigrateV1(): AssignmentContextCarryoverV2 | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_V1);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AssignmentContextCarryoverV1>;
    if (
      typeof parsed.priorSubmissionId !== 'string' ||
      typeof parsed.priorAssignmentId !== 'string' ||
      typeof parsed.classroomId !== 'string' ||
      typeof parsed.studentId !== 'string' ||
      typeof parsed.at !== 'number'
    ) {
      return null;
    }
    const v2: AssignmentContextCarryoverV2 = {
      v: 2,
      studentId: parsed.studentId,
      classroomId: parsed.classroomId,
      chain: [
        {
          priorSubmissionId: parsed.priorSubmissionId,
          priorAssignmentId: parsed.priorAssignmentId,
          at: parsed.at,
        },
      ],
    };
    sessionStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2));
    sessionStorage.removeItem(STORAGE_KEY_V1);
    return v2;
  } catch {
    return null;
  }
}

export function readAssignmentContextCarryover(): AssignmentContextCarryoverV2 | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_V2);
    if (raw) {
      return parseV2(raw);
    }
    return tryMigrateV1();
  } catch {
    return null;
  }
}

/**
 * Appends a completed assignment to the per-classroom unit chain (dedupes by assignment id, caps length).
 */
export function appendAssignmentContextCarryover(
  entry: Omit<CarriedAssignmentEntry, 'at'> & { at?: number },
  root: { studentId: string; classroomId: string },
): void {
  try {
    const ts = entry.at ?? Date.now();
    let chain: CarriedAssignmentEntry[] = [];
    const existing = readAssignmentContextCarryover();
    if (
      existing &&
      existing.studentId === root.studentId &&
      existing.classroomId === root.classroomId
    ) {
      chain = existing.chain.filter((e) => e.priorAssignmentId !== entry.priorAssignmentId);
    }
    chain.push({
      priorSubmissionId: entry.priorSubmissionId,
      priorAssignmentId: entry.priorAssignmentId,
      at: ts,
    });
    while (chain.length > MAX_CHAIN_ENTRIES) chain.shift();
    const v2: AssignmentContextCarryoverV2 = {
      v: 2,
      studentId: root.studentId,
      classroomId: root.classroomId,
      chain,
    };
    sessionStorage.setItem(STORAGE_KEY_V2, JSON.stringify(v2));
    try {
      sessionStorage.removeItem(STORAGE_KEY_V1);
    } catch {
      /* ignore */
    }
  } catch {
    /* quota / private mode */
  }
}

/** @deprecated Use appendAssignmentContextCarryover — overwrites whole chain; kept for emergencies only. */
export function writeAssignmentContextCarryover(
  payload: Omit<CarriedAssignmentEntry, 'at'> & {
    at?: number;
    classroomId: string;
    studentId: string;
  },
): void {
  appendAssignmentContextCarryover(
    {
      priorSubmissionId: payload.priorSubmissionId,
      priorAssignmentId: payload.priorAssignmentId,
      at: payload.at,
    },
    { studentId: payload.studentId, classroomId: payload.classroomId },
  );
}

export function clearAssignmentContextCarryover(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY_V2);
    sessionStorage.removeItem(STORAGE_KEY_V1);
  } catch {
    /* ignore */
  }
}

/** Ordered list of prior submission ids (oldest → newest) eligible for context on the current assignment. */
export function pickEligiblePriorSubmissionIds(
  stored: AssignmentContextCarryoverV2 | null,
  studentId: string,
  classroomId: string,
  currentAssignmentId: string,
): string[] {
  if (!stored || stored.studentId !== studentId || stored.classroomId !== classroomId) return [];
  const now = Date.now();
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const e of stored.chain) {
    if (e.priorAssignmentId === currentAssignmentId) continue;
    if (now - e.at > TTL_MS) continue;
    if (seen.has(e.priorSubmissionId)) continue;
    seen.add(e.priorSubmissionId);
    ids.push(e.priorSubmissionId);
  }
  return ids;
}
