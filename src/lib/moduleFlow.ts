import type {
  ModuleFlowStep,
  ResourceType,
  SectionResource,
  SyllabusSection,
  ModuleFlowStepKind,
} from '@/types/syllabus';
import type { FlowStepInput } from '@/services/moduleFlowService';

/**
 * Activities center + module flow only include these: combined lessons and legacy text/video activities.
 * Generic outline materials (file, link, document, image) stay in Course Outline only.
 */
export function isActivityCenterResourceType(resourceType: ResourceType): boolean {
  return resourceType === 'lesson' || resourceType === 'text' || resourceType === 'video';
}

export function isActivityCenterResource(resource: SectionResource): boolean {
  return isActivityCenterResourceType(resource.resource_type);
}

/** Assignment steps plus resource steps whose linked material is lesson/text/video (not outline-only files/links). */
export function filterActivityCenterModuleFlowSteps(
  steps: ModuleFlowStep[],
  sectionResources: SectionResource[],
): ModuleFlowStep[] {
  return steps.filter((step) => {
    if (step.step_kind === 'assignment') return true;
    if (step.step_kind === 'resource' && step.activity_list_id) {
      const r = sectionResources.find((x) => x.id === step.activity_list_id);
      return r ? isActivityCenterResource(r) : false;
    }
    return false;
  });
}

/** Filter + sort by `order_index` for activity-center steps in a module. */
export function getOrderedActivityCenterFlowSteps(
  steps: ModuleFlowStep[],
  sectionResources: SectionResource[],
): ModuleFlowStep[] {
  return [...filterActivityCenterModuleFlowSteps(steps, sectionResources)].sort(
    (a, b) => a.order_index - b.order_index,
  );
}

/** Next step in teacher-defined order, or undefined if last or not found. */
export function getNextActivityCenterStep(
  orderedSteps: ModuleFlowStep[],
  currentStepId: string,
): ModuleFlowStep | undefined {
  const i = orderedSteps.findIndex((s) => s.id === currentStepId);
  if (i < 0 || i >= orderedSteps.length - 1) return undefined;
  return orderedSteps[i + 1];
}

export type ComputedFlowItem =
  | { kind: 'resource'; activity_list_id: string; order_index: number }
  | { kind: 'assignment'; assignment_id: string; order_index: number };

/** Assignment fields used for module flow ordering and merge. */
export type AssignmentRow = {
  id: string;
  syllabus_section_id?: string | null;
  due_at?: string | null;
  attempt_mode?: string | null;
};

/** Same ordering as the assignment tail of `computeDefaultModuleFlow` (due_at, then id). */
export function sortAssignmentsForSection(sectionAssignments: AssignmentRow[]): AssignmentRow[] {
  return sectionAssignments.slice().sort((a, b) => {
    const da = a.due_at ? new Date(a.due_at).getTime() : 0;
    const db = b.due_at ? new Date(b.due_at).getTime() : 0;
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
}

export type ModuleFlowLocalStep =
  | { kind: 'resource'; resourceId: string }
  | { kind: 'assignment'; assignmentId: string };

/** Append section-linked assignments missing from `base` (sorted like default flow). */
export function appendMissingSectionLinkedAssignments(
  base: ModuleFlowLocalStep[],
  sectionAssignments: AssignmentRow[],
): ModuleFlowLocalStep[] {
  const present = new Set(
    base.filter((s): s is { kind: 'assignment'; assignmentId: string } => s.kind === 'assignment').map((s) => s.assignmentId),
  );
  const missing = sortAssignmentsForSection(sectionAssignments).filter((a) => !present.has(a.id));
  if (missing.length === 0) return base;
  return [...base, ...missing.map((a) => ({ kind: 'assignment' as const, assignmentId: a.id }))];
}

/** Append activity-center resources (lesson/text/video) for the section that are missing from `base`, by outline order. */
export function appendMissingActivityCenterResources(
  base: ModuleFlowLocalStep[],
  sectionId: string,
  resources: SectionResource[],
): ModuleFlowLocalStep[] {
  const present = new Set(
    base
      .filter((s): s is { kind: 'resource'; resourceId: string } => s.kind === 'resource')
      .map((s) => s.resourceId),
  );
  const missing = resources
    .filter((r) => r.section_id === sectionId && isActivityCenterResource(r) && !present.has(r.id))
    .slice()
    .sort((a, b) => a.order_index - b.order_index);
  if (missing.length === 0) return base;
  return [...base, ...missing.map((r) => ({ kind: 'resource' as const, resourceId: r.id }))];
}

/** Map computed default flow to local step shape (no assignment append). */
export function computedFlowItemsToLocalSteps(items: ComputedFlowItem[]): ModuleFlowLocalStep[] {
  return items.map((c) =>
    c.kind === 'resource'
      ? { kind: 'resource', resourceId: c.activity_list_id }
      : { kind: 'assignment', assignmentId: c.assignment_id },
  );
}

/**
 * Activity-center flow steps before appending missing section-linked assignments.
 * Used when comparing whether auto-persist should run in ModuleFlowEditor.
 */
export function resolveDisplayedModuleFlowBase(
  sectionId: string,
  resources: SectionResource[],
  assignments: AssignmentRow[],
  persistedSteps: ModuleFlowStep[],
): ModuleFlowLocalStep[] {
  const computedDefault = computeDefaultModuleFlow(sectionId, resources, assignments);

  let base: ModuleFlowLocalStep[];
  if (persistedSteps.length > 0) {
    const filtered = filterActivityCenterModuleFlowSteps(persistedSteps, resources);
    const ordered = [...filtered].sort((a, b) => a.order_index - b.order_index);
    if (ordered.length > 0) {
      base = ordered.map((s) =>
        s.step_kind === 'resource' && s.activity_list_id
          ? { kind: 'resource', resourceId: s.activity_list_id }
          : { kind: 'assignment', assignmentId: s.assignment_id! },
      );
    } else {
      base = computedFlowItemsToLocalSteps(computedDefault);
    }
  } else {
    base = computedFlowItemsToLocalSteps(computedDefault);
  }

  return base;
}

/**
 * Steady-state module flow for display (Activities page) and as the server baseline in ModuleFlowEditor.
 * Matches persisted activity-center steps when present (ordered by order_index), else default computation,
 * then appends missing activity-center resources and section-linked assignments (same idea as outline sync).
 */
/** Drop flow steps whose resource or assignment no longer exists (deleted rows, stale persisted steps). */
export function filterOrphanModuleFlowLocalSteps(
  steps: ModuleFlowLocalStep[],
  resources: SectionResource[],
  allAssignments: AssignmentRow[],
): ModuleFlowLocalStep[] {
  const assignmentIds = new Set(allAssignments.map((a) => a.id));
  return steps.filter((s) => {
    if (s.kind === 'resource') {
      const r = resources.find((x) => x.id === s.resourceId);
      return r ? isActivityCenterResource(r) : false;
    }
    return assignmentIds.has(s.assignmentId);
  });
}

/** Teacher curriculum list: persisted/default base without full student merge, but hide orphan steps. */
export function resolveTeacherCurriculumModuleFlow(
  sectionId: string,
  resources: SectionResource[],
  assignments: AssignmentRow[],
  persistedSteps: ModuleFlowStep[],
): ModuleFlowLocalStep[] {
  const base = resolveDisplayedModuleFlowBase(sectionId, resources, assignments, persistedSteps);
  return filterOrphanModuleFlowLocalSteps(base, resources, assignments);
}

export function resolveDisplayedModuleFlow(
  sectionId: string,
  resources: SectionResource[],
  assignments: AssignmentRow[],
  persistedSteps: ModuleFlowStep[],
): ModuleFlowLocalStep[] {
  const base = resolveDisplayedModuleFlowBase(sectionId, resources, assignments, persistedSteps);
  const sectionAssignments = assignments.filter((a) => a.syllabus_section_id === sectionId);
  let merged = appendMissingActivityCenterResources(base, sectionId, resources);
  /** When the teacher has a saved flow, do not append every section-linked assignment — that undoes removals from the flow. */
  const hasSavedActivityCenterFlow =
    persistedSteps.length > 0 &&
    filterActivityCenterModuleFlowSteps(persistedSteps, resources).length > 0;
  if (!hasSavedActivityCenterFlow) {
    merged = appendMissingSectionLinkedAssignments(merged, sectionAssignments);
  }
  return filterOrphanModuleFlowLocalSteps(merged, resources, assignments);
}

export function moduleFlowLocalStepsEqual(a: ModuleFlowLocalStep[], b: ModuleFlowLocalStep[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.kind !== y.kind) return false;
    if (x.kind === 'resource' && y.kind === 'resource') {
      if (x.resourceId !== y.resourceId) return false;
    } else if (x.kind === 'assignment' && y.kind === 'assignment') {
      if (x.assignmentId !== y.assignmentId) return false;
    }
  }
  return true;
}

/**
 * When no persisted module_flow_steps exist, derive a default ordering:
 * section resources by order_index, then assignments for that section (by due_at then id).
 */
export function computeDefaultModuleFlow(
  sectionId: string,
  resources: SectionResource[],
  assignments: AssignmentRow[],
): ComputedFlowItem[] {
  const res = resources
    .filter((r) => r.section_id === sectionId && isActivityCenterResource(r))
    .slice()
    .sort((a, b) => a.order_index - b.order_index);
  const assigns = sortAssignmentsForSection(assignments.filter((a) => a.syllabus_section_id === sectionId));

  let i = 0;
  const out: ComputedFlowItem[] = [];
  for (const r of res) {
    out.push({ kind: 'resource', activity_list_id: r.id, order_index: i++ });
  }
  for (const a of assigns) {
    out.push({ kind: 'assignment', assignment_id: a.id, order_index: i++ });
  }
  return out;
}

/**
 * Match a computed item to a persisted flow step (same kind + target id).
 */
export function flowItemMatchesStep(
  item: ComputedFlowItem,
  step: { step_kind: ModuleFlowStepKind; activity_list_id: string | null; assignment_id: string | null },
): boolean {
  if (item.kind === 'resource' && step.step_kind === 'resource') {
    return step.activity_list_id === item.activity_list_id;
  }
  if (item.kind === 'assignment' && step.step_kind === 'assignment') {
    return step.assignment_id === item.assignment_id;
  }
  return false;
}

/** Ordered sections for unlock checks (same as Course Outline). */
export function orderedSections(sections: SyllabusSection[]): SyllabusSection[] {
  return [...sections].sort((a, b) => a.order_index - b.order_index);
}

/** Persist local module-flow steps to the API shape (order_index + step_kind + ids). */
export function moduleFlowLocalStepsToFlowInput(localSteps: ModuleFlowLocalStep[]): FlowStepInput[] {
  return localSteps.map((s, order_index) =>
    s.kind === 'resource'
      ? {
          order_index,
          step_kind: 'resource',
          activity_list_id: s.resourceId,
          assignment_id: null,
        }
      : {
          order_index,
          step_kind: 'assignment',
          activity_list_id: null,
          assignment_id: s.assignmentId,
        },
  );
}

/**
 * Student outline / linked-assignments lists: when the teacher saved `module_flow_steps`, only assignments
 * that appear as assignment steps should show — not every row with `syllabus_section_id`.
 * If there is no saved flow (`persistedFlowSteps` empty), keep legacy behavior (all section-linked assignments).
 * Order matches module flow `order_index`.
 */
export function linkedAssignmentsVisibleInModuleFlow<T extends { id: string }>(
  sectionLinked: T[],
  persistedFlowSteps: ModuleFlowStep[] | undefined | null,
): T[] {
  if (!persistedFlowSteps || persistedFlowSteps.length === 0) {
    return sectionLinked;
  }
  const orderedIds: string[] = [];
  const seen = new Set<string>();
  [...persistedFlowSteps]
    .sort((a, b) => a.order_index - b.order_index)
    .forEach((s) => {
      if (s.step_kind === 'assignment' && s.assignment_id && !seen.has(s.assignment_id)) {
        seen.add(s.assignment_id);
        orderedIds.push(s.assignment_id);
      }
    });
  if (orderedIds.length === 0) return [];
  const byId = new Map(sectionLinked.map((a) => [a.id, a]));
  return orderedIds.map((id) => byId.get(id)).filter((a): a is T => a !== undefined);
}

/** Same ordering the curriculum tab and flow editor use, ready for `replaceModuleFlowSteps`. */
export function buildResolvedModuleFlowStepInputs(
  sectionId: string,
  resources: SectionResource[],
  assignments: AssignmentRow[],
  persistedSteps: ModuleFlowStep[],
): FlowStepInput[] {
  return moduleFlowLocalStepsToFlowInput(
    resolveDisplayedModuleFlow(sectionId, resources, assignments, persistedSteps),
  );
}
