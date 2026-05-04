import { describe, it, expect } from 'vitest';
import {
  resolveStudentResumeTarget,
  findFirstIncompleteDisplayedFlowAcrossCourse,
} from './resolveStudentResumeTarget';
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

  it('returns the next assignment when the first is complete (default displayed flow)', () => {
    const sections: SyllabusSection[] = [
      { id: 'm1', title: 'M1', order_index: 0 } as SyllabusSection,
    ];
    const flowCtx: StudentFlowProgressContext = {
      progressByStep: {},
      assignmentDoneMap: { a1: true },
    };
    const target = resolveStudentResumeTarget({
      sections,
      releaseMode: 'all_at_once',
      studentProgressMap: {},
      flowBulk: { m1: [] },
      resourceMap: { m1: [] },
      assignments: [
        { id: 'a1', syllabus_section_id: 'm1' },
        { id: 'a2', syllabus_section_id: 'm1' },
      ],
      flowCtx,
    });
    expect(target).toEqual({ kind: 'assignment', id: 'a2' });
  });

  it('returns null when all displayed steps are complete', () => {
    const sections: SyllabusSection[] = [
      { id: 'm1', title: 'M1', order_index: 0 } as SyllabusSection,
    ];
    const flowCtx: StudentFlowProgressContext = {
      progressByStep: {},
      assignmentDoneMap: { a1: true, a2: true },
    };
    const target = resolveStudentResumeTarget({
      sections,
      releaseMode: 'all_at_once',
      studentProgressMap: {},
      flowBulk: { m1: [] },
      resourceMap: { m1: [] },
      assignments: [
        { id: 'a1', syllabus_section_id: 'm1' },
        { id: 'a2', syllabus_section_id: 'm1' },
      ],
      flowCtx,
    });
    expect(target).toBeNull();
  });

  it('returns null when the only incomplete assignment is past due with no attempt', () => {
    const sections: SyllabusSection[] = [
      { id: 'm1', title: 'M1', order_index: 0 } as SyllabusSection,
    ];
    const flowCtx: StudentFlowProgressContext = {
      progressByStep: {},
      assignmentDoneMap: {},
      assignmentHasSubmissionRowMap: {},
    };
    const target = resolveStudentResumeTarget({
      sections,
      releaseMode: 'all_at_once',
      studentProgressMap: {},
      flowBulk: { m1: [] },
      resourceMap: { m1: [] },
      assignments: [
        {
          id: 'a1',
          syllabus_section_id: 'm1',
          attempt_mode: 'multiple_until_due',
          due_at: '2020-01-01T00:00:00.000Z',
        },
      ],
      flowCtx,
      now: new Date('2026-05-03T12:00:00.000Z'),
    });
    expect(target).toBeNull();
  });

  it('returns the next assignment when the first is missed', () => {
    const sections: SyllabusSection[] = [
      { id: 'm1', title: 'M1', order_index: 0 } as SyllabusSection,
    ];
    const flowCtx: StudentFlowProgressContext = {
      progressByStep: {},
      assignmentDoneMap: {},
      assignmentHasSubmissionRowMap: {},
    };
    const target = resolveStudentResumeTarget({
      sections,
      releaseMode: 'all_at_once',
      studentProgressMap: {},
      flowBulk: { m1: [] },
      resourceMap: { m1: [] },
      assignments: [
        {
          id: 'a1',
          syllabus_section_id: 'm1',
          attempt_mode: 'multiple_until_due',
          due_at: '2020-01-01T00:00:00.000Z',
        },
        { id: 'a2', syllabus_section_id: 'm1', due_at: '2030-01-01T00:00:00.000Z' },
      ],
      flowCtx,
      now: new Date('2026-05-03T12:00:00.000Z'),
    });
    expect(target).toEqual({ kind: 'assignment', id: 'a2' });
  });

  it('sequential resume unlocks next module when prior flow is complete without completed row', () => {
    const sections: SyllabusSection[] = [
      { id: 'm1', title: 'M1', order_index: 0 } as SyllabusSection,
      { id: 'm2', title: 'M2', order_index: 1 } as SyllabusSection,
    ];
    const flowCtx: StudentFlowProgressContext = {
      progressByStep: {},
      assignmentDoneMap: { a1: true },
    };
    const flowBulk = { m1: [], m2: [] };
    const resourceMap = { m1: [], m2: [] };
    const assignments = [
      { id: 'a1', syllabus_section_id: 'm1' },
      { id: 'a2', syllabus_section_id: 'm2' },
    ];
    expect(
      resolveStudentResumeTarget({
        sections,
        releaseMode: 'sequential',
        studentProgressMap: {},
        flowBulk,
        resourceMap,
        assignments,
        flowCtx,
      }),
    ).toEqual({ kind: 'assignment', id: 'a2' });

    expect(
      findFirstIncompleteDisplayedFlowAcrossCourse({
        sections,
        flowBulk,
        resourceMap,
        assignments,
        flowCtx,
      }),
    ).toEqual({ kind: 'assignment', id: 'a2' });
  });
});
