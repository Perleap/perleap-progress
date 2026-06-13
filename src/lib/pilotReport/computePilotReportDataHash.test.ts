import { describe, it, expect } from 'vitest';
import { computePilotReportDataHash, type PilotReportAnalyticsData } from './computePilotReportDataHash';

const sectionTitleResolver = () => 'Section';

function baseData(overrides: Partial<PilotReportAnalyticsData> = {}): PilotReportAnalyticsData {
  return {
    assignments: [
      { id: 'a1', title: 'A1', syllabusSectionId: 'm1' },
      { id: 'a2', title: 'A2', syllabusSectionId: 'm1' },
    ],
    students: [
      {
        id: 's2',
        fullName: 'Bob',
        submissions: [{ student_id: 's2', assignment_id: 'a1', status: 'completed' }],
        snapshots: [
          {
            user_id: 's2',
            submission_id: 'sub2',
            scores: { vision: 5, values: 5, thinking: 5, connection: 5, action: 5 },
          },
        ],
        narrativeRows: [],
      },
      {
        id: 's1',
        fullName: 'Alice',
        submissions: [{ student_id: 's1', assignment_id: 'a1', status: 'completed' }],
        snapshots: [
          {
            user_id: 's1',
            submission_id: 'sub1',
            scores: { vision: 7, values: 6, thinking: 5, connection: 4, action: 3 },
          },
        ],
        narrativeRows: [],
      },
    ],
    rawSubmissions: [
      { id: 'sub1', assignment_id: 'a1' },
      { id: 'sub2', assignment_id: 'a1' },
    ],
    ...overrides,
  };
}

describe('computePilotReportDataHash', () => {
  it('is stable regardless of student array order', () => {
    const data = baseData();
    const hashA = computePilotReportDataHash({
      analyticsData: data,
      scopeModule: 'all',
      scopeAssignment: 'all',
      language: 'en',
      sectionTitleResolver,
    });
    const hashB = computePilotReportDataHash({
      analyticsData: {
        ...data,
        students: [...data.students].reverse(),
      },
      scopeModule: 'all',
      scopeAssignment: 'all',
      language: 'en',
      sectionTitleResolver,
    });
    expect(hashA).toBe(hashB);
  });

  it('changes when scores change', () => {
    const data = baseData();
    const before = computePilotReportDataHash({
      analyticsData: data,
      scopeModule: 'all',
      scopeAssignment: 'all',
      language: 'en',
      sectionTitleResolver,
    });
    const after = computePilotReportDataHash({
      analyticsData: {
        ...data,
        students: data.students.map((s) =>
          s.id === 's1'
            ? {
                ...s,
                snapshots: [
                  {
                    ...s.snapshots[0]!,
                    scores: { vision: 9, values: 9, thinking: 9, connection: 9, action: 9 },
                  },
                ],
              }
            : s,
        ),
      },
      scopeModule: 'all',
      scopeAssignment: 'all',
      language: 'en',
      sectionTitleResolver,
    });
    expect(before).not.toBe(after);
  });

  it('changes when language changes', () => {
    const data = baseData();
    const en = computePilotReportDataHash({
      analyticsData: data,
      scopeModule: 'all',
      scopeAssignment: 'all',
      language: 'en',
      sectionTitleResolver,
    });
    const he = computePilotReportDataHash({
      analyticsData: data,
      scopeModule: 'all',
      scopeAssignment: 'all',
      language: 'he',
      sectionTitleResolver,
    });
    expect(en).not.toBe(he);
  });

  it('changes when scope changes', () => {
    const data = baseData();
    const all = computePilotReportDataHash({
      analyticsData: data,
      scopeModule: 'all',
      scopeAssignment: 'all',
      language: 'en',
      sectionTitleResolver,
    });
    const scoped = computePilotReportDataHash({
      analyticsData: data,
      scopeModule: 'all',
      scopeAssignment: 'a1',
      language: 'en',
      sectionTitleResolver,
    });
    expect(all).not.toBe(scoped);
  });
});
