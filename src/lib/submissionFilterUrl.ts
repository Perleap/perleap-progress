export type SubmissionViewModeUrl =
  | 'list'
  | 'grid'
  | 'compact'
  | 'detailed'
  | 'table'
  | 'timeline';

export const SUB_URL = {
  MODULE: 'subModule',
  ASSIGNMENT: 'subAssignment',
  STUDENT: 'subStudent',
  STATUS: 'subStatus',
  FROM: 'subFrom',
  TO: 'subTo',
  Q: 'subQ',
  VIEW: 'subView',
} as const;

const VIEW_MODES: SubmissionViewModeUrl[] = [
  'list',
  'grid',
  'compact',
  'detailed',
  'table',
  'timeline',
];

const STATUS_VALUES = new Set(['all', 'completed', 'in_progress']);

export interface SubmissionFiltersSnapshot {
  module: string;
  assignment: string;
  student: string;
  status: string;
  from: string;
  to: string;
  q: string;
  view: SubmissionViewModeUrl;
}

export function defaultSubmissionFilters(): SubmissionFiltersSnapshot {
  return {
    module: 'all',
    assignment: 'all',
    student: 'all',
    status: 'all',
    from: '',
    to: '',
    q: '',
    view: 'list',
  };
}

export function readSubmissionFiltersFromSearchParams(
  searchParams: URLSearchParams,
  ctx: {
    moduleIds: Set<string>;
    assignmentIds: Set<string>;
    studentIds: Set<string>;
  }
): SubmissionFiltersSnapshot {
  const defaults = defaultSubmissionFilters();
  const m = searchParams.get(SUB_URL.MODULE);
  const a = searchParams.get(SUB_URL.ASSIGNMENT);
  const s = searchParams.get(SUB_URL.STUDENT);
  const st = searchParams.get(SUB_URL.STATUS);
  const from = searchParams.get(SUB_URL.FROM);
  const to = searchParams.get(SUB_URL.TO);
  const q = searchParams.get(SUB_URL.Q);
  const view = searchParams.get(SUB_URL.VIEW);

  return {
    module: m === 'all' || (m && ctx.moduleIds.has(m)) ? (m ?? defaults.module) : defaults.module,
    assignment:
      a === 'all' || (a && ctx.assignmentIds.has(a)) ? (a ?? defaults.assignment) : defaults.assignment,
    student:
      s === 'all' || (s && ctx.studentIds.has(s)) ? (s ?? defaults.student) : defaults.student,
    status: st && STATUS_VALUES.has(st) ? st : defaults.status,
    from: from ?? defaults.from,
    to: to ?? defaults.to,
    q: q ?? defaults.q,
    view: view && VIEW_MODES.includes(view as SubmissionViewModeUrl)
      ? (view as SubmissionViewModeUrl)
      : defaults.view,
  };
}

export function clearSubmissionFilterSearchParams(base: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(base);
  for (const key of Object.values(SUB_URL)) {
    next.delete(key);
  }
  return next;
}

export function applySubmissionFiltersToSearchParams(
  base: URLSearchParams,
  filters: SubmissionFiltersSnapshot
): URLSearchParams {
  const next = new URLSearchParams(base);
  next.set(SUB_URL.MODULE, filters.module);
  next.set(SUB_URL.ASSIGNMENT, filters.assignment);
  next.set(SUB_URL.STUDENT, filters.student);
  next.set(SUB_URL.STATUS, filters.status);
  if (filters.from) next.set(SUB_URL.FROM, filters.from);
  else next.delete(SUB_URL.FROM);
  if (filters.to) next.set(SUB_URL.TO, filters.to);
  else next.delete(SUB_URL.TO);
  if (filters.q.trim()) next.set(SUB_URL.Q, filters.q.trim());
  else next.delete(SUB_URL.Q);
  next.set(SUB_URL.VIEW, filters.view);
  return next;
}
