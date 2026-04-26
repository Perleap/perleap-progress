import type { Json } from '@/integrations/supabase/types';
import type { FiveDScores } from '@/types/models';
import type { SyllabusStructureType } from '@/types/syllabus';

export type AnalyticsModuleFilter = 'all' | 'unplaced' | string;

export type AnalyticsAssignmentRef = {
  id: string;
  title: string;
  syllabusSectionId: string | null;
  /** For analytics narratives; optional in list UIs that omit it. */
  instructions?: string | null;
};

export type AnalyticsModuleRef = {
  id: string;
  title: string;
  orderIndex: number;
};

/**
 * Resolves the set of assignment ids included in the current analytics filter.
 * - module `all` + assignment `all` → all classroom assignment ids
 * - module section id + assignment `all` → ids in that section
 * - module `unplaced` + assignment `all` → unlinked assignments
 * - any module + specific assignment → intersection with singleton (empty if out of scope)
 */
export function getAllowedAssignmentIds(
  allAssignments: AnalyticsAssignmentRef[],
  selectedModule: AnalyticsModuleFilter,
  selectedAssignment: 'all' | string,
): string[] {
  const allIds = allAssignments.map((a) => a.id);

  if (selectedAssignment !== 'all') {
    if (!allIds.includes(selectedAssignment)) return [];
    const a = allAssignments.find((x) => x.id === selectedAssignment);
    if (!a) return [];
    if (selectedModule === 'all') return [selectedAssignment];
    if (selectedModule === 'unplaced') {
      return a.syllabusSectionId == null ? [selectedAssignment] : [];
    }
    return a.syllabusSectionId === selectedModule ? [selectedAssignment] : [];
  }

  if (selectedModule === 'all') return allIds;
  if (selectedModule === 'unplaced') {
    return allAssignments.filter((a) => a.syllabusSectionId == null).map((a) => a.id);
  }
  return allAssignments.filter((a) => a.syllabusSectionId === selectedModule).map((a) => a.id);
}

/**
 * Whether the "unplaced" module option should appear (assignments not linked to a section).
 */
export function hasUnplacedAssignments(allAssignments: AnalyticsAssignmentRef[]): boolean {
  return allAssignments.some((a) => a.syllabusSectionId == null);
}

/**
 * i18n key segment for filter label: weeks | units | modules
 */
export function structureTypeToLabelKey(
  t: SyllabusStructureType | null | undefined,
): 'weeks' | 'units' | 'modules' {
  if (t === 'weeks' || t === 'units' || t === 'modules') return t;
  return 'modules';
}

const DIMS = ['vision', 'values', 'thinking', 'connection', 'action'] as const;

export function meanScoreRecords(rows: { scores: Json }[]): FiveDScores | null {
  if (rows.length === 0) return null;
  const totals: FiveDScores = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
  for (const r of rows) {
    const sc = r.scores as Record<string, number>;
    for (const k of DIMS) {
      totals[k] += sc[k] || 0;
    }
  }
  const n = rows.length;
  return {
    vision: totals.vision / n,
    values: totals.values / n,
    thinking: totals.thinking / n,
    connection: totals.connection / n,
    action: totals.action / n,
  };
}

function meanOfStudentMeans(arr: FiveDScores[]): FiveDScores | null {
  if (arr.length === 0) return null;
  const totals: FiveDScores = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
  for (const r of arr) {
    for (const k of DIMS) {
      totals[k] += r[k] || 0;
    }
  }
  const n = arr.length;
  return {
    vision: totals.vision / n,
    values: totals.values / n,
    thinking: totals.thinking / n,
    connection: totals.connection / n,
    action: totals.action / n,
  };
}

type SnapshotRow = {
  user_id: string;
  submission_id: string;
  scores: Json;
  score_explanations?: Json | null;
};

type StudentForAvg = { id: string; snapshots: SnapshotRow[] };

/**
 * 5D class / student line chart: matches existing semantics — for "all" assignments, average per student
 * over their best snapshots in scope, then average across students (class) or return one student.
 * For a single selected assignment, averages snapshot rows in scope (one best per student typically).
 */
export function getClassroomAverage5D(
  students: StudentForAvg[],
  rawSubmissions: { id: string; assignment_id: string }[],
  allAssignments: AnalyticsAssignmentRef[],
  selectedModule: AnalyticsModuleFilter,
  selectedAssignment: 'all' | string,
  selectedStudent: 'all' | string,
  rawSnapshotsFlat: SnapshotRow[],
): FiveDScores | null {
  const allowed = getAllowedAssignmentIds(allAssignments, selectedModule, selectedAssignment);
  if (allowed.length === 0) return null;
  const allowSet = new Set(allowed);
  const subToAssign = new Map(rawSubmissions.map((s) => [s.id, s.assignment_id]));

  if (selectedAssignment !== 'all') {
    const list = rawSnapshotsFlat.filter((s) => {
      const a = subToAssign.get(s.submission_id);
      return a != null && allowSet.has(a) && a === selectedAssignment;
    });
    const withStudent =
      selectedStudent === 'all' ? list : list.filter((r) => r.user_id === selectedStudent);
    return meanScoreRecords(withStudent);
  }

  const perStudentMeans: FiveDScores[] = [];
  for (const st of students) {
    if (selectedStudent !== 'all' && st.id !== selectedStudent) continue;
    const rows = st.snapshots.filter((s) => {
      const a = subToAssign.get(s.submission_id);
      return a != null && allowSet.has(a);
    });
    const m = meanScoreRecords(rows);
    if (m) perStudentMeans.push(m);
  }
  if (perStudentMeans.length === 0) return null;
  if (selectedStudent !== 'all') return perStudentMeans[0] ?? null;
  return meanOfStudentMeans(perStudentMeans);
}

/**
 * One student's 5D mean over best snapshots, limited to the given assignment ids.
 */
export function scopedStudentLatestScores(
  studentSnapshots: SnapshotRow[],
  rawSubmissions: { id: string; assignment_id: string }[],
  allowedAssignmentIds: string[],
): FiveDScores | null {
  if (allowedAssignmentIds.length === 0) return null;
  const set = new Set(allowedAssignmentIds);
  const subToAssign = new Map(rawSubmissions.map((s) => [s.id, s.assignment_id]));
  const rows = studentSnapshots.filter((s) => {
    const a = subToAssign.get(s.submission_id);
    return a != null && set.has(a);
  });
  return meanScoreRecords(rows);
}
