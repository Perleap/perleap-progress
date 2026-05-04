import type { AssignmentRow } from '@/lib/moduleFlow';
import { isSectionActivityFlowFullyComplete } from '@/lib/moduleFlowStudent';
import type { StudentFlowProgressContext } from '@/lib/moduleFlowStudent';
import type {
  ModuleFlowStep,
  SectionResource,
  SyllabusSection,
  ReleaseMode,
  StudentProgressStatus,
} from '@/types/syllabus';

/** Course order: `order_index` then stable `id` so ties are not non-deterministic across renders. */
export function sectionsInCourseOrder(sections: SyllabusSection[]): SyllabusSection[] {
  return [...sections].sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));
}

/**
 * When provided, sequential unlock treats a prior section as satisfied if its syllabus row is
 * `completed` **or** its module-activity flow has no remaining actionable steps (same rule as Curriculum).
 */
export type SectionSequentialUnlockFlow = {
  flowBulk: Record<string, ModuleFlowStep[]>;
  resourceMap: Record<string, SectionResource[]>;
  assignments: AssignmentRow[];
  flowCtx: StudentFlowProgressContext;
  now: Date;
};

function priorSectionSatisfiedForSequential(
  prior: SyllabusSection,
  studentProgressMap: Record<string, StudentProgressStatus>,
  flow: SectionSequentialUnlockFlow | null | undefined,
): boolean {
  if (studentProgressMap[prior.id] === 'completed') return true;
  if (!flow) return false;
  return isSectionActivityFlowFullyComplete(
    prior.id,
    flow.flowBulk[prior.id] ?? [],
    flow.resourceMap[prior.id] ?? [],
    flow.assignments,
    flow.flowCtx,
    flow.now,
  );
}

export function isSectionUnlocked(
  section: SyllabusSection,
  allSections: SyllabusSection[],
  releaseMode: ReleaseMode,
  studentProgressMap: Record<string, StudentProgressStatus>,
  sequentialFlow?: SectionSequentialUnlockFlow | null,
): boolean {
  switch (releaseMode) {
    case 'all_at_once':
      return true;

    case 'sequential': {
      const ordered = sectionsInCourseOrder(allSections);
      const idx = ordered.findIndex((s) => s.id === section.id);
      if (idx < 0) return false;
      if (idx === 0) return true;
      for (let j = 0; j < idx; j++) {
        if (!priorSectionSatisfiedForSequential(ordered[j], studentProgressMap, sequentialFlow)) {
          return false;
        }
      }
      return true;
    }

    case 'date_based': {
      if (!section.start_date) return true;
      return new Date(section.start_date) <= new Date();
    }

    case 'manual':
      return !section.is_locked;

    default:
      return true;
  }
}
