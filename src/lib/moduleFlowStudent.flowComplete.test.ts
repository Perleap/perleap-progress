import { describe, expect, it } from 'vitest';
import { isSectionActivityFlowFullyComplete } from './moduleFlowStudent';
import type { ModuleFlowStep, SectionResource } from '@/types/syllabus';

const ts = '2020-01-01T00:00:00.000Z';

function flowResourceStep(
  id: string,
  sectionId: string,
  resourceId: string,
  order = 0,
): ModuleFlowStep {
  return {
    id,
    section_id: sectionId,
    order_index: order,
    step_kind: 'resource',
    activity_list_id: resourceId,
    assignment_id: null,
    created_at: ts,
    updated_at: ts,
  };
}

function flowAssignmentStep(
  id: string,
  sectionId: string,
  assignmentId: string,
  order = 0,
): ModuleFlowStep {
  return {
    id,
    section_id: sectionId,
    order_index: order,
    step_kind: 'assignment',
    activity_list_id: null,
    assignment_id: assignmentId,
    created_at: ts,
    updated_at: ts,
  };
}

function lessonResource(id: string, sectionId: string): SectionResource {
  return {
    id,
    section_id: sectionId,
    title: 'Lesson',
    resource_type: 'lesson',
    file_path: null,
    url: null,
    mime_type: null,
    file_size: null,
    order_index: 0,
    created_at: ts,
    updated_at: ts,
  };
}

describe('isSectionActivityFlowFullyComplete', () => {
  const sid = 'sec-1';
  const emptyCtx = { progressByStep: {}, assignmentDoneMap: {} };
  const refNow = new Date('2035-01-01T00:00:00.000Z');

  it('returns false when there are no activity-center flow steps', () => {
    expect(isSectionActivityFlowFullyComplete(sid, [], [], [], emptyCtx, refNow)).toBe(false);
  });

  it('persisted path: true when every ordered step is done', () => {
    const r = lessonResource('res-1', sid);
    const step = flowResourceStep('step-1', sid, r.id);
    expect(
      isSectionActivityFlowFullyComplete(sid, [step], [r], [], {
        progressByStep: { 'step-1': true },
        assignmentDoneMap: {},
      }, refNow),
    ).toBe(true);
  });

  it('persisted path: false when a resource step is not marked complete', () => {
    const r = lessonResource('res-1', sid);
    const step = flowResourceStep('step-1', sid, r.id);
    expect(isSectionActivityFlowFullyComplete(sid, [step], [r], [], emptyCtx, refNow)).toBe(false);
  });

  it('persisted path: resource inferred done when a later assignment is complete', () => {
    const r = lessonResource('res-1', sid);
    const stepR = flowResourceStep('step-r', sid, r.id, 0);
    const stepA = flowAssignmentStep('step-a', sid, 'a1', 1);
    expect(
      isSectionActivityFlowFullyComplete(sid, [stepR, stepA], [r], [], {
        progressByStep: {},
        assignmentDoneMap: { a1: true },
      }, refNow),
    ).toBe(true);
  });

  it('persisted path: assignment step follows assignmentDoneMap', () => {
    const step = flowAssignmentStep('step-1', sid, 'a1', 0);
    expect(
      isSectionActivityFlowFullyComplete(sid, [step], [], [], {
        progressByStep: {},
        assignmentDoneMap: { a1: false },
      }, refNow),
    ).toBe(false);
    expect(
      isSectionActivityFlowFullyComplete(sid, [step], [], [], {
        progressByStep: {},
        assignmentDoneMap: { a1: true },
      }, refNow),
    ).toBe(true);
  });

  it('computed path when no persisted steps: assignment-only module', () => {
    expect(
      isSectionActivityFlowFullyComplete(
        sid,
        [],
        [],
        [{ id: 'a1', syllabus_section_id: sid, due_at: null }],
        { progressByStep: {}, assignmentDoneMap: { a1: true } },
        refNow,
      ),
    ).toBe(true);
    expect(
      isSectionActivityFlowFullyComplete(
        sid,
        [],
        [],
        [{ id: 'a1', syllabus_section_id: sid, due_at: null }],
        { progressByStep: {}, assignmentDoneMap: { a1: false } },
        refNow,
      ),
    ).toBe(false);
  });

  it('persisted path: true when only remaining work is a missed-deadline assignment', () => {
    const r = lessonResource('res-1', sid);
    const stepR = flowResourceStep('step-r', sid, r.id, 0);
    const stepA = flowAssignmentStep('step-a', sid, 'a1', 1);
    const afterDue = new Date('2026-05-03T12:00:00.000Z');
    expect(
      isSectionActivityFlowFullyComplete(
        sid,
        [stepR, stepA],
        [r],
        [
          {
            id: 'a1',
            syllabus_section_id: sid,
            due_at: '2020-01-01T00:00:00.000Z',
            attempt_mode: 'multiple_until_due',
          },
        ],
        {
          progressByStep: { 'step-r': true },
          assignmentDoneMap: {},
          assignmentHasSubmissionRowMap: {},
        },
        afterDue,
      ),
    ).toBe(true);
  });

  it('computed path: true when only assignment is missed-deadline', () => {
    const afterDue = new Date('2026-05-03T12:00:00.000Z');
    expect(
      isSectionActivityFlowFullyComplete(
        sid,
        [],
        [],
        [
          {
            id: 'a1',
            syllabus_section_id: sid,
            due_at: '2020-01-01T00:00:00.000Z',
            attempt_mode: 'multiple_until_due',
          },
        ],
        {
          progressByStep: {},
          assignmentDoneMap: {},
          assignmentHasSubmissionRowMap: {},
        },
        afterDue,
      ),
    ).toBe(true);
  });
});
