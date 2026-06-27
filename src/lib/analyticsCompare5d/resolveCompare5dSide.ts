import { build5dNarrativeEvidence } from '@/lib/analytics5dEvidence';
import {
  getAllowedAssignmentIds,
  getClassroomAverage5D,
  getClassroomAverageQedMeasures,
  type AnalyticsAssignmentRef,
  type AnalyticsModuleFilter,
  type AnalyticsModuleRef,
} from '@/lib/analyticsScope';
import type {
  Compare5dMode,
  Compare5dSideResult,
  Compare5dStudentRow,
  ResolveCompare5dSideInput,
} from './types';

export function assignmentsInCompareScope(
  assignments: AnalyticsAssignmentRef[],
  scopeModule: AnalyticsModuleFilter,
): AnalyticsAssignmentRef[] {
  const allowed = getAllowedAssignmentIds(assignments, scopeModule, 'all');
  const set = new Set(allowed);
  return assignments.filter((a) => set.has(a.id));
}

export function compare5dModeAvailability(
  modules: AnalyticsModuleRef[],
  showUnplaced: boolean,
  students: Compare5dStudentRow[],
  assignments: AnalyticsAssignmentRef[],
): Record<Compare5dMode, boolean> {
  const sectionCount = modules.length + (showUnplaced ? 1 : 0);
  return {
    sections: sectionCount >= 2,
    students: students.length >= 2,
    assignments: assignments.length >= 2,
  };
}

export function defaultCompare5dMode(
  availability: Record<Compare5dMode, boolean>,
): Compare5dMode | null {
  if (availability.sections) return 'sections';
  if (availability.students) return 'students';
  if (availability.assignments) return 'assignments';
  return null;
}

export function sideOptionsForCompare5dMode(
  mode: Compare5dMode,
  students: Compare5dStudentRow[],
  assignments: AnalyticsAssignmentRef[],
  modules: AnalyticsModuleRef[],
  showUnplaced: boolean,
  scopeModule: AnalyticsModuleFilter,
): { id: string; label: string }[] {
  if (mode === 'sections') {
    const items = modules.map((m) => ({ id: m.id, label: m.title }));
    if (showUnplaced) {
      items.push({ id: 'unplaced', label: '__unplaced__' });
    }
    return items;
  }
  if (mode === 'students') {
    return students.map((s) => ({ id: s.id, label: s.fullName }));
  }
  return assignmentsInCompareScope(assignments, scopeModule).map((a) => ({
    id: a.id,
    label: a.title,
  }));
}

function emptySide(label: string): Compare5dSideResult {
  return {
    scores: null,
    qed: null,
    evidence: { evidenceText: '', sourceCount: 0 },
    label,
    narrativeContext: 'module_compare',
  };
}

export function resolveCompare5dSide(input: ResolveCompare5dSideInput): Compare5dSideResult {
  const {
    mode,
    sideId,
    scopeModule,
    scopeAssignment,
    students,
    assignments,
    rawSubmissions,
    rawSnapshots,
    sectionTitleResolver,
    labelForSection,
    labelForStudent,
    labelForAssignment,
  } = input;

  if (!sideId) {
    return emptySide('');
  }

  const snapshotRowsForAvg = students.map((s) => ({
    id: s.id,
    snapshots: s.snapshots,
  }));

  const allStudentsNarr = students.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    narrativeRows: s.narrativeRows ?? [],
  }));

  if (mode === 'sections') {
    const label = labelForSection(sideId);
    const moduleFilter = sideId as AnalyticsModuleFilter;
    const scores = getClassroomAverage5D(
      snapshotRowsForAvg,
      rawSubmissions,
      assignments,
      moduleFilter,
      'all',
      'all',
      rawSnapshots,
    );
    const qed = getClassroomAverageQedMeasures(
      snapshotRowsForAvg,
      rawSubmissions,
      assignments,
      moduleFilter,
      'all',
      'all',
      rawSnapshots,
    );
    const allowed = getAllowedAssignmentIds(assignments, moduleFilter, 'all');
    const evidence = build5dNarrativeEvidence({
      context: 'module_compare',
      allowedAssignmentIds: allowed,
      compareModuleId: sideId === 'unplaced' ? 'unplaced' : sideId,
      allStudents: allStudentsNarr,
      assignmentRefs: assignments,
      sectionTitleResolver,
    });
    return { scores, qed, evidence, label, narrativeContext: 'module_compare' };
  }

  if (mode === 'students') {
    const label = labelForStudent(sideId);
    const allowed = getAllowedAssignmentIds(assignments, scopeModule, scopeAssignment);
    if (allowed.length === 0) {
      return { ...emptySide(label), narrativeContext: 'student_compare' };
    }
    const scores = getClassroomAverage5D(
      snapshotRowsForAvg,
      rawSubmissions,
      assignments,
      scopeModule,
      scopeAssignment,
      sideId,
      rawSnapshots,
    );
    const qed = getClassroomAverageQedMeasures(
      snapshotRowsForAvg,
      rawSubmissions,
      assignments,
      scopeModule,
      scopeAssignment,
      sideId,
      rawSnapshots,
    );
    const evidence = build5dNarrativeEvidence({
      context: 'student_avg',
      allowedAssignmentIds: allowed,
      allStudents: allStudentsNarr,
      assignmentRefs: assignments,
      singleStudentId: sideId,
      sectionTitleResolver,
    });
    return { scores, qed, evidence, label, narrativeContext: 'student_compare' };
  }

  const label = labelForAssignment(sideId);
  const allowed = getAllowedAssignmentIds(assignments, scopeModule, sideId);
  if (allowed.length === 0) {
    return { ...emptySide(label), narrativeContext: 'assignment_compare' };
  }
  const scores = getClassroomAverage5D(
    snapshotRowsForAvg,
    rawSubmissions,
    assignments,
    scopeModule,
    sideId,
    'all',
    rawSnapshots,
  );
  const qed = getClassroomAverageQedMeasures(
    snapshotRowsForAvg,
    rawSubmissions,
    assignments,
    scopeModule,
    sideId,
    'all',
    rawSnapshots,
  );
  const evidence = build5dNarrativeEvidence({
    context: 'class_avg',
    allowedAssignmentIds: allowed,
    allStudents: allStudentsNarr,
    assignmentRefs: assignments,
    sectionTitleResolver,
  });
  return { scores, qed, evidence, label, narrativeContext: 'assignment_compare' };
}

export function buildCompare5dScopeSummary(
  mode: Compare5dMode,
  scopeModule: AnalyticsModuleFilter,
  scopeAssignment: 'all' | string,
  assignments: AnalyticsAssignmentRef[],
  allModulesLabel: string,
  unplacedLabel: string,
  allAssignmentsLabel: string,
  allAssignmentsInScopeLabel: string,
  modules: AnalyticsModuleRef[],
): string {
  if (mode === 'sections') return '';
  const mod =
    scopeModule === 'all'
      ? allModulesLabel
      : scopeModule === 'unplaced'
        ? unplacedLabel
        : (modules.find((m) => m.id === scopeModule)?.title ?? scopeModule);
  if (mode === 'assignments') {
    return mod;
  }
  const asg =
    scopeAssignment === 'all'
      ? scopeModule === 'all'
        ? allAssignmentsLabel
        : allAssignmentsInScopeLabel
      : (assignments.find((a) => a.id === scopeAssignment)?.title ?? scopeAssignment);
  return [mod, asg].join(' | ');
}
