import { describe, expect, it } from 'vitest';
import {
  filterStudentVisibleAssignments,
  filterStudentVisibleSectionResources,
  getOrderedActivityCenterFlowSteps,
} from './moduleFlow';
import type { ModuleFlowStep, SectionResource } from '@/types/syllabus';

const ts = '2020-01-01T00:00:00.000Z';
const sid = 'sec-1';

function flowResourceStep(id: string, resourceId: string, order = 0): ModuleFlowStep {
  return {
    id,
    section_id: sid,
    order_index: order,
    step_kind: 'resource',
    activity_list_id: resourceId,
    assignment_id: null,
    created_at: ts,
    updated_at: ts,
  };
}

function flowAssignmentStep(id: string, assignmentId: string, order = 0): ModuleFlowStep {
  return {
    id,
    section_id: sid,
    order_index: order,
    step_kind: 'assignment',
    activity_list_id: null,
    assignment_id: assignmentId,
    created_at: ts,
    updated_at: ts,
  };
}

function lessonResource(id: string): SectionResource {
  return {
    id,
    section_id: sid,
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

describe('getOrderedActivityCenterFlowSteps student assignment visibility', () => {
  const resource = lessonResource('res-1');
  const publishedAssignmentId = 'assign-published';
  const draftAssignmentId = 'assign-draft';

  const steps = [
    flowResourceStep('step-res', resource.id, 0),
    flowAssignmentStep('step-published', publishedAssignmentId, 1),
    flowAssignmentStep('step-draft', draftAssignmentId, 2),
  ];

  const studentOpts = {
    hideLiveSessions: true,
    assignmentsById: {
      [publishedAssignmentId]: { type: 'test' },
    },
  };

  it('keeps assignment steps present in assignmentsById', () => {
    const ordered = getOrderedActivityCenterFlowSteps(steps, [resource], studentOpts);
    expect(ordered.map((s) => s.id)).toEqual(['step-res', 'step-published']);
  });

  it('drops assignment steps missing from assignmentsById (draft / RLS-hidden)', () => {
    const ordered = getOrderedActivityCenterFlowSteps(steps, [resource], studentOpts);
    expect(ordered.some((s) => s.assignment_id === draftAssignmentId)).toBe(false);
  });

  it('does not filter resource steps', () => {
    const ordered = getOrderedActivityCenterFlowSteps(steps, [resource], studentOpts);
    expect(ordered.some((s) => s.activity_list_id === resource.id)).toBe(true);
  });

  it('does not filter assignment steps when assignmentsById is omitted (teacher paths)', () => {
    const ordered = getOrderedActivityCenterFlowSteps(steps, [resource]);
    expect(ordered.map((s) => s.id)).toEqual(['step-res', 'step-published', 'step-draft']);
  });
});

describe('filterStudentVisibleAssignments', () => {
  it('keeps published assignments only', () => {
    const out = filterStudentVisibleAssignments([
      { id: 'a', status: 'published' },
      { id: 'b', status: 'draft' },
      { id: 'c', status: 'archived' },
    ]);
    expect(out.map((a) => a.id)).toEqual(['a']);
  });
});

describe('filterStudentVisibleSectionResources', () => {
  it('omits draft activity_list rows per section', () => {
    const published = lessonResource('pub');
    const draft: SectionResource = { ...lessonResource('draft'), status: 'draft' };
    const out = filterStudentVisibleSectionResources({ [sid]: [published, draft] });
    expect(out[sid].map((r) => r.id)).toEqual(['pub']);
  });
});
