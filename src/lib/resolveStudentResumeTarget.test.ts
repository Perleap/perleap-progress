import { describe, it, expect } from 'vitest';
import { resolveStudentResumeTarget } from './resolveStudentResumeTarget';
import type { SyllabusSection } from '@/types/syllabus';
import type { StudentFlowProgressContext } from './moduleFlowStudent';

describe('resolveStudentResumeTarget', () => {
  it('returns first incomplete assignment from computed default flow when no persisted steps', () => {
    const sections: SyllabusSection[] = [
      { id: 'm1', title: 'M1', order_index: 0 } as SyllabusSection,
    ];
    const flowCtx: StudentFlowProgressContext = {
      progressByStep: {},
      assignmentDoneMap: {},
    };
    const target = resolveStudentResumeTarget({
      sections,
      releaseMode: 'all_at_once',
      studentProgressMap: {},
      flowBulk: { m1: [] },
      resourceMap: { m1: [] },
      assignments: [{ id: 'a1', syllabus_section_id: 'm1' }],
      flowCtx,
    });
    expect(target).toEqual({ kind: 'assignment', id: 'a1' });
  });
});
