/**
 * Student navigation targets across module flow steps and syllabus sections.
 */

import {
  orderedSections,
  resolveDisplayedModuleFlow,
  type AssignmentRow,
  type ComputedFlowItem,
} from '@/lib/moduleFlow';
import type { ModuleFlowStep, SectionResource, SyllabusSection } from '@/types/syllabus';

export type FlowStepTarget =
  | { kind: 'resource'; id: string }
  | { kind: 'assignment'; id: string };

export function getNextInSectionAfterAssignment(params: {
  usePersistedFlow: boolean;
  orderedPersisted: ModuleFlowStep[];
  computed: ComputedFlowItem[];
  assignmentId: string;
}): FlowStepTarget | null {
  const { usePersistedFlow, orderedPersisted, computed, assignmentId } = params;
  if (usePersistedFlow) {
    const idx = orderedPersisted.findIndex(
      (s) => s.step_kind === 'assignment' && s.assignment_id === assignmentId,
    );
    if (idx < 0) return null;
    const next = orderedPersisted[idx + 1];
    if (!next) return null;
    if (next.step_kind === 'resource' && next.activity_list_id) {
      return { kind: 'resource', id: next.activity_list_id };
    }
    if (next.step_kind === 'assignment' && next.assignment_id) {
      return { kind: 'assignment', id: next.assignment_id };
    }
    return null;
  }
  const idx = computed.findIndex((c) => c.kind === 'assignment' && c.assignment_id === assignmentId);
  if (idx < 0) return null;
  const next = computed[idx + 1];
  if (!next) return null;
  if (next.kind === 'resource') return { kind: 'resource', id: next.activity_list_id };
  return { kind: 'assignment', id: next.assignment_id };
}

export function getFirstNavigableInSection(params: {
  sectionId: string;
  sectionResources: SectionResource[];
  assignments: AssignmentRow[];
  persistedSteps: ModuleFlowStep[];
}): FlowStepTarget | null {
  const local = resolveDisplayedModuleFlow(
    params.sectionId,
    params.sectionResources,
    params.assignments,
    params.persistedSteps,
  );
  const first = local[0];
  if (!first) return null;
  if (first.kind === 'resource') return { kind: 'resource', id: first.resourceId };
  return { kind: 'assignment', id: first.assignmentId };
}

export function getNextSectionId(
  sections: SyllabusSection[] | undefined,
  currentSectionId: string | null | undefined,
): string | undefined {
  if (!currentSectionId || !sections?.length) return undefined;
  const ordered = orderedSections(sections);
  const i = ordered.findIndex((s) => s.id === currentSectionId);
  if (i < 0 || i >= ordered.length - 1) return undefined;
  return ordered[i + 1].id;
}
