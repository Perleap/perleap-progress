import type { Assignment } from '@/types';
import { aggregateCurriculumStepProgress } from '@/lib/curriculumStepProgress';
import { linkedAssignmentsVisibleInModuleFlow, type AssignmentRow } from '@/lib/moduleFlow';
import type { StudentFlowProgressContext } from '@/lib/moduleFlowStudent';
import type { ModuleFlowStep, SyllabusWithSections } from '@/types/syllabus';

export type WholeCourseComputationResult = {
  done: number;
  total: number;
  percent: number;
  meaningful: boolean;
};

/** Linked assignments per section, filtered like {@link useWholeCourseCurriculumProgress}. */
export function buildLinkedAssignmentsMapWholeCourse(
  syllabusComputationEnabled: boolean,
  rawAssignments: Assignment[],
  moduleFlowBulk: Record<string, ModuleFlowStep[]>,
): Record<
  string,
  Array<{ id: string; title: string; type: string; due_at: string | null }>
> {
  const map: Record<
    string,
    Array<{ id: string; title: string; type: string; due_at: string | null }>
  > = {};
  if (!syllabusComputationEnabled) return map;

  rawAssignments.forEach((a) => {
    const sectionId = a.syllabus_section_id;
    if (sectionId) {
      if (!map[sectionId]) map[sectionId] = [];
      map[sectionId].push({
        id: a.id,
        title: a.title,
        type: a.type,
        due_at: a.due_at,
      });
    }
  });
  for (const sectionId of Object.keys(map)) {
    const flow = moduleFlowBulk[sectionId];
    map[sectionId] = linkedAssignmentsVisibleInModuleFlow(map[sectionId], flow);
  }
  return map;
}

/**
 * Same curriculum % as {@link useWholeCourseCurriculumProgress} once inputs match hook state.
 */
export function computeWholeCourseCurriculumAggregate(opts: {
  syllabus: SyllabusWithSections | null | undefined;
  syllabusComputationEnabled: boolean;
  rawAssignments: AssignmentRow[];
  moduleFlowBulk: Record<string, ModuleFlowStep[]>;
  flowCtx: StudentFlowProgressContext;
}): WholeCourseComputationResult {
  const { syllabus, syllabusComputationEnabled, rawAssignments, moduleFlowBulk, flowCtx } = opts;

  if (!syllabusComputationEnabled || !syllabus?.sections?.length) {
    return { done: 0, total: 0, percent: 0, meaningful: false };
  }

  const linkedAssignmentsMap = buildLinkedAssignmentsMapWholeCourse(
    true,
    rawAssignments as Assignment[],
    moduleFlowBulk,
  );

  const aggregate = aggregateCurriculumStepProgress({
    sections: syllabus.sections,
    flowBulk: moduleFlowBulk,
    sectionResources: syllabus.section_resources ?? {},
    linkedAssignmentsMap,
    assignments: rawAssignments,
    flowCtx,
  });

  const meaningful = aggregate.total > 0;

  return { ...aggregate, meaningful };
}
