import { describe, expect, it } from 'vitest';
import { escapeCsvField, buildClassroomAnalyticsCsv } from './analyticsExport';

describe('escapeCsvField', () => {
  it('quotes fields with comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });
  it('escapes quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('buildClassroomAnalyticsCsv', () => {
  it('includes metadata and 5D rows', () => {
    const csv = buildClassroomAnalyticsCsv({
      classroomId: 'cid',
      exportedAtIso: '2026-01-01',
      structureTypeLabel: 'modules',
      filterSummary: 'all',
      assignmentCountInScope: 2,
      enrolledStudents: 10,
      coveredStudents: 5,
      classAverage5D: {
        vision: 5,
        values: 5,
        thinking: 5,
        connection: 5,
        action: 5,
      },
      kpi: {
        totalSubmissions: 20,
        activeStudents: 5,
        completionPercent: 50,
        avgSubmissions: '2.0',
      },
    });
    expect(csv).toContain('classroom_id,cid');
    expect(csv).toContain('vision,5.00');
  });
});
