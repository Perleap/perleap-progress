import { describe, expect, it } from 'vitest';
import {
  computeAnalyticsKpiDisplay,
  filterReportableAssignments,
  getAllowedAssignmentIds,
  getClassroomAverage5D,
  type AnalyticsAssignmentRef,
} from './analyticsScope';

const sampleAssignments: AnalyticsAssignmentRef[] = [
  { id: 'a1', title: 'A1', syllabusSectionId: 'm1' },
  { id: 'a2', title: 'A2', syllabusSectionId: 'm1' },
  { id: 'u1', title: 'U1', syllabusSectionId: null },
];

describe('getAllowedAssignmentIds', () => {
  it('returns all ids when both filters are all', () => {
    expect(
      getAllowedAssignmentIds(sampleAssignments, 'all', 'all').sort(),
    ).toEqual(['a1', 'a2', 'u1'].sort());
  });
  it('returns section subset', () => {
    expect(
      getAllowedAssignmentIds(sampleAssignments, 'm1', 'all').sort(),
    ).toEqual(['a1', 'a2'].sort());
  });
  it('returns unplaced', () => {
    expect(getAllowedAssignmentIds(sampleAssignments, 'unplaced', 'all')).toEqual(['u1']);
  });
  it('intersects single assignment with module', () => {
    expect(getAllowedAssignmentIds(sampleAssignments, 'm1', 'a1')).toEqual(['a1']);
  });
  it('rejects single assignment if not in module', () => {
    expect(getAllowedAssignmentIds(sampleAssignments, 'm1', 'u1')).toEqual([]);
  });
});

describe('computeAnalyticsKpiDisplay', () => {
  const mixedAssignments: AnalyticsAssignmentRef[] = [
    { id: 'pub1', title: 'Published 1', syllabusSectionId: 'm1', status: 'published', active: true, deletedAt: null },
    { id: 'pub2', title: 'Published 2', syllabusSectionId: 'm1', status: 'published', active: true, deletedAt: null },
    { id: 'draft', title: 'Draft', syllabusSectionId: 'm1', status: 'draft', active: true, deletedAt: null },
  ];

  it('counts only reportable assignments and feedback in the default (all) view', () => {
    const result = computeAnalyticsKpiDisplay({
      isNarrowingView: false,
      allAssignments: mixedAssignments,
      effectiveAssignmentIds: mixedAssignments.map((a) => a.id),
      rawFeedback: [
        { assignment_id: 'pub1', student_id: 's1' },
        { assignment_id: 'pub1', student_id: 's1' },
        { assignment_id: 'pub1', student_id: 's2' },
        { assignment_id: 'draft', student_id: 's1' },
      ],
      enrolledStudentCount: 5,
    });

    expect(result.assignmentCount).toBe(2);
    expect(result.totalSubmissions).toBe(2);
    expect(result.activeStudents).toBe(2);
    expect(result.completionPercent).toBe(40);
  });

  it('dedupes retakes: one count per student-assignment pair', () => {
    const result = computeAnalyticsKpiDisplay({
      isNarrowingView: false,
      allAssignments: mixedAssignments,
      effectiveAssignmentIds: ['pub1', 'pub2'],
      rawFeedback: [
        { assignment_id: 'pub1', student_id: 's1' },
        { assignment_id: 'pub1', student_id: 's1' },
        { assignment_id: 'pub1', student_id: 's1' },
        { assignment_id: 'pub2', student_id: 's1' },
      ],
      enrolledStudentCount: 5,
    });

    expect(result.totalSubmissions).toBe(2);
  });

  it('uses scoped counts when filters narrow the view', () => {
    const result = computeAnalyticsKpiDisplay({
      isNarrowingView: true,
      allAssignments: mixedAssignments,
      effectiveAssignmentIds: ['pub1'],
      rawFeedback: [
        { assignment_id: 'pub1', student_id: 's1' },
        { assignment_id: 'pub2', student_id: 's2' },
      ],
      enrolledStudentCount: 5,
    });

    expect(result.assignmentCount).toBe(1);
    expect(result.totalSubmissions).toBe(1);
    expect(result.activeStudents).toBe(1);
  });
});

describe('filterReportableAssignments', () => {
  const mixed: AnalyticsAssignmentRef[] = [
    { id: 'pub', title: 'Published', syllabusSectionId: null, status: 'published', active: true, deletedAt: null },
    { id: 'draft', title: 'Draft', syllabusSectionId: null, status: 'draft', active: true, deletedAt: null },
    { id: 'arch', title: 'Archived', syllabusSectionId: null, status: 'archived', active: true, deletedAt: null },
    { id: 'del', title: 'Deleted', syllabusSectionId: null, status: 'published', active: false, deletedAt: '2026-01-01' },
  ];

  it('keeps only published, active, non-deleted assignments', () => {
    expect(filterReportableAssignments(mixed).map((a) => a.id)).toEqual(['pub']);
  });

  it('passes through assignments without reportability metadata (tests)', () => {
    expect(filterReportableAssignments(sampleAssignments)).toHaveLength(3);
  });
});

describe('getClassroomAverage5D', () => {
  it('returns null for empty allowed set', () => {
    const result = getClassroomAverage5D(
      [],
      [],
      sampleAssignments,
      'm1',
      'missing',
      'all',
      [],
    );
    expect(result).toBeNull();
  });
});
