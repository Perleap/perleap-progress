import { describe, expect, it } from 'vitest';
import type { FiveDScores } from '@/types/models';
import { countStudentCompletedAssignmentsInScope, scoreCell } from '@/lib/analyticsLessonBriefPdf';

describe('countStudentCompletedAssignmentsInScope', () => {
  it('counts distinct scoped assignments that have at least one completed submission', () => {
    const submissions = [
      {
        student_id: 'stu1',
        assignment_id: 'a1',
        status: 'completed',
      },
      {
        student_id: 'stu1',
        assignment_id: 'a1',
        status: 'in_progress',
      },
      { student_id: 'stu1', assignment_id: 'a2', status: 'completed' },
      { student_id: 'stu2', assignment_id: 'a1', status: 'completed' },
      { student_id: 'stu1', assignment_id: 'a3', status: 'in_progress' },
    ];
    expect(countStudentCompletedAssignmentsInScope('stu1', submissions, ['a1', 'a2', 'a3'])).toBe(
      2
    );
  });

  it('returns 0 when scope is empty', () => {
    expect(
      countStudentCompletedAssignmentsInScope(
        'stu1',
        [{ student_id: 'stu1', assignment_id: 'a', status: 'completed' }],
        []
      )
    ).toBe(0);
  });
});

describe('scoreCell', () => {
  it('formats dimension or returns dash when no scores', () => {
    const scores: FiveDScores = {
      vision: 2.567,
      values: 1,
      thinking: 3,
      connection: 4,
      action: 5,
    };
    expect(scoreCell(scores, 'vision', '—')).toBe('2.57');
    expect(scoreCell(null, 'values', '—')).toBe('—');
  });
});
