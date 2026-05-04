import { describe, expect, it } from 'vitest';
import type { AssignmentRow } from '@/lib/moduleFlow';
import type { ModuleFlowStep, SectionResource, SyllabusSection } from '@/types/syllabus';
import { aggregateCurriculumStepProgress } from '@/lib/curriculumStepProgress';

function syllabusSection(id: string, order_index: number): SyllabusSection {
  return {
    id,
    syllabus_id: 'syl1',
    title: id,
    description: null,
    content: null,
    order_index,
    start_date: null,
    end_date: null,
    objectives: [],
    resources: null,
    notes: null,
    completion_status: 'auto',
    prerequisites: [],
    is_locked: false,
    created_at: '',
    updated_at: '',
  };
}

function assignmentRow(id: string, sectionId: string): AssignmentRow {
  return { id, syllabus_section_id: sectionId };
}

function assignmentStep(
  id: string,
  sectionId: string,
  order_index: number,
  assignmentId: string
): ModuleFlowStep {
  return {
    id,
    section_id: sectionId,
    order_index,
    step_kind: 'assignment',
    activity_list_id: null,
    assignment_id: assignmentId,
    created_at: '',
    updated_at: '',
  };
}

function lessonResource(id: string, sectionId: string, order_index: number): SectionResource {
  return {
    id,
    section_id: sectionId,
    title: 'Lesson',
    resource_type: 'lesson',
    file_path: null,
    url: null,
    mime_type: null,
    file_size: null,
    order_index,
  };
}

describe('aggregateCurriculumStepProgress', () => {
  it('returns zeros when there are no sections', () => {
    const r = aggregateCurriculumStepProgress({
      sections: [],
      flowBulk: {},
      sectionResources: {},
      linkedAssignmentsMap: {},
      assignments: [],
      flowCtx: { progressByStep: {}, assignmentDoneMap: {} },
    });
    expect(r).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it('uses computeDefaultModuleFlow when no persisted activity-center steps (activities + assignments)', () => {
    const sec = syllabusSection('m1', 0);
    const res = lessonResource('r1', 'm1', 0);
    const r = aggregateCurriculumStepProgress({
      sections: [sec],
      flowBulk: {},
      sectionResources: { m1: [res] },
      linkedAssignmentsMap: {
        m1: [{ id: 'a1' }, { id: 'a2' }],
      },
      assignments: [assignmentRow('a1', 'm1'), assignmentRow('a2', 'm1')],
      flowCtx: {
        progressByStep: {},
        assignmentDoneMap: { a1: true, a2: false },
      },
    });
    expect(r.total).toBe(3);
    expect(r.done).toBe(2);
    expect(r.percent).toBe(67);
  });

  it('assignments-only module (no activity resources) counts assignments', () => {
    const sec = syllabusSection('m1', 0);
    const r = aggregateCurriculumStepProgress({
      sections: [sec],
      flowBulk: {},
      sectionResources: {},
      linkedAssignmentsMap: {
        m1: [{ id: 'a1' }, { id: 'a2' }],
      },
      assignments: [assignmentRow('a1', 'm1'), assignmentRow('a2', 'm1')],
      flowCtx: {
        progressByStep: {},
        assignmentDoneMap: { a1: true, a2: false },
      },
    });
    expect(r.done).toBe(1);
    expect(r.total).toBe(2);
    expect(r.percent).toBe(50);
  });

  it('uses persisted flow when non-empty ordered flow exists', () => {
    const sec = syllabusSection('m1', 0);
    const steps = [assignmentStep('st1', 'm1', 0, 'a1'), assignmentStep('st2', 'm1', 1, 'a2')];
    const r = aggregateCurriculumStepProgress({
      sections: [sec],
      flowBulk: { m1: steps },
      sectionResources: {},
      linkedAssignmentsMap: {
        m1: [{ id: 'a1' }, { id: 'a2' }],
      },
      assignments: [assignmentRow('a1', 'm1'), assignmentRow('a2', 'm1')],
      flowCtx: {
        progressByStep: {},
        assignmentDoneMap: { a1: true, a2: true },
      },
    });
    expect(r.done).toBe(2);
    expect(r.total).toBe(2);
    expect(r.percent).toBe(100);
  });

  it('sums across multiple sections in course order', () => {
    const a = syllabusSection('a', 0);
    const b = syllabusSection('b', 1);
    const r = aggregateCurriculumStepProgress({
      sections: [b, a],
      flowBulk: {},
      sectionResources: {},
      linkedAssignmentsMap: {
        a: [{ id: 'x1' }, { id: 'x2' }],
        b: [{ id: 'y1' }],
      },
      assignments: [assignmentRow('x1', 'a'), assignmentRow('x2', 'a'), assignmentRow('y1', 'b')],
      flowCtx: {
        progressByStep: {},
        assignmentDoneMap: { x1: true, x2: false, y1: false },
      },
    });
    expect(r.total).toBe(3);
    expect(r.done).toBe(1);
    expect(r.percent).toBe(33);
  });

  it('onlySectionId limits aggregate to that module', () => {
    const a = syllabusSection('a', 0);
    const b = syllabusSection('b', 1);
    const full = aggregateCurriculumStepProgress({
      sections: [a, b],
      flowBulk: {},
      sectionResources: {},
      linkedAssignmentsMap: {
        a: [{ id: 'x1' }, { id: 'x2' }],
        b: [{ id: 'y1' }, { id: 'y2' }, { id: 'y3' }],
      },
      assignments: [
        assignmentRow('x1', 'a'),
        assignmentRow('x2', 'a'),
        assignmentRow('y1', 'b'),
        assignmentRow('y2', 'b'),
        assignmentRow('y3', 'b'),
      ],
      flowCtx: {
        progressByStep: {},
        assignmentDoneMap: { x1: true, x2: true, y1: true, y2: false, y3: false },
      },
    });
    expect(full.done).toBe(3);
    expect(full.total).toBe(5);
    expect(full.percent).toBe(60);

    const scoped = aggregateCurriculumStepProgress({
      sections: [a, b],
      flowBulk: {},
      sectionResources: {},
      linkedAssignmentsMap: {
        a: [{ id: 'x1' }, { id: 'x2' }],
        b: [{ id: 'y1' }, { id: 'y2' }, { id: 'y3' }],
      },
      assignments: [
        assignmentRow('x1', 'a'),
        assignmentRow('x2', 'a'),
        assignmentRow('y1', 'b'),
        assignmentRow('y2', 'b'),
        assignmentRow('y3', 'b'),
      ],
      flowCtx: {
        progressByStep: {},
        assignmentDoneMap: { x1: true, x2: true, y1: true, y2: false, y3: false },
      },
      onlySectionId: 'b',
    });
    expect(scoped.done).toBe(1);
    expect(scoped.total).toBe(3);
    expect(scoped.percent).toBe(33);
  });
});
