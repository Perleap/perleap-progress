import { describe, expect, it } from 'vitest';
import {
  assignmentsInCompareScope,
  compare5dModeAvailability,
  defaultCompare5dMode,
  resolveCompare5dSide,
} from './resolveCompare5dSide';
import type { AnalyticsAssignmentRef } from '@/lib/analyticsScope';

const assignments: AnalyticsAssignmentRef[] = [
  { id: 'a1', title: 'Essay 1', syllabusSectionId: 'm1' },
  { id: 'a2', title: 'Essay 2', syllabusSectionId: 'm1' },
];

const modules = [{ id: 'm1', title: 'Module 1', orderIndex: 0 }];

const students = [
  {
    id: 's1',
    fullName: 'Alice',
    snapshots: [
      {
        user_id: 's1',
        submission_id: 'sub1',
        scores: { vision: 8, values: 7, thinking: 6, connection: 5, action: 4 },
      },
    ],
    narrativeRows: [],
  },
  {
    id: 's2',
    fullName: 'Bob',
    snapshots: [
      {
        user_id: 's2',
        submission_id: 'sub2',
        scores: { vision: 5, values: 5, thinking: 5, connection: 5, action: 5 },
      },
    ],
    narrativeRows: [],
  },
];

const rawSubmissions = [
  { id: 'sub1', assignment_id: 'a1' },
  { id: 'sub2', assignment_id: 'a1' },
];

const rawSnapshots = students.flatMap((s) => s.snapshots);

const baseInput = {
  students,
  assignments,
  modules,
  rawSubmissions,
  rawSnapshots,
  sectionTitleResolver: () => 'Section',
  labelForSection: (id: string) => (id === 'm1' ? 'Module 1' : id),
  labelForStudent: (id: string) => students.find((s) => s.id === id)?.fullName ?? id,
  labelForAssignment: (id: string) => assignments.find((a) => a.id === id)?.title ?? id,
  scopeModule: 'all' as const,
  scopeAssignment: 'all' as const,
};

describe('compare5dModeAvailability', () => {
  it('enables sections when 2+ sections exist', () => {
    expect(
      compare5dModeAvailability(
        [
          { id: 'm1', title: 'A', orderIndex: 0 },
          { id: 'm2', title: 'B', orderIndex: 1 },
        ],
        false,
        students,
        assignments,
      ).sections,
    ).toBe(true);
  });

  it('defaults to sections when available', () => {
    const avail = compare5dModeAvailability(
      [
        { id: 'm1', title: 'A', orderIndex: 0 },
        { id: 'm2', title: 'B', orderIndex: 1 },
      ],
      false,
      students,
      assignments,
    );
    expect(defaultCompare5dMode(avail)).toBe('sections');
  });
});

describe('assignmentsInCompareScope', () => {
  it('filters assignments by section', () => {
    expect(assignmentsInCompareScope(assignments, 'm1').map((a) => a.id).sort()).toEqual([
      'a1',
      'a2',
    ]);
  });
});

describe('resolveCompare5dSide', () => {
  it('section mode uses module filter and module_compare narrative', () => {
    const r = resolveCompare5dSide({
      ...baseInput,
      mode: 'sections',
      sideId: 'm1',
    });
    expect(r.label).toBe('Module 1');
    expect(r.narrativeContext).toBe('module_compare');
    expect(r.scores?.vision).toBe(6.5);
  });

  it('student mode respects single assignment scope', () => {
    const r = resolveCompare5dSide({
      ...baseInput,
      mode: 'students',
      sideId: 's1',
      scopeModule: 'm1',
      scopeAssignment: 'a1',
    });
    expect(r.narrativeContext).toBe('student_compare');
    expect(r.scores?.vision).toBe(8);
  });

  it('assignment mode uses class avg for one assignment', () => {
    const r = resolveCompare5dSide({
      ...baseInput,
      mode: 'assignments',
      sideId: 'a1',
    });
    expect(r.narrativeContext).toBe('assignment_compare');
    expect(r.label).toBe('Essay 1');
    expect(r.scores?.vision).toBe(6.5);
  });

  it('returns null scores when sideId is empty', () => {
    const r = resolveCompare5dSide({
      ...baseInput,
      mode: 'students',
      sideId: '',
    });
    expect(r.scores).toBeNull();
  });
});
