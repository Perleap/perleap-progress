import type { PilotParticipantAssessmentResult } from '@/services/pilotReadinessService';
import {
  PILOT_DIMENSION_KEYS,
  PILOT_DIMENSION_WEIGHTS,
  PILOT_READINESS_VALUES,
  PILOT_ROLE_FIT_VALUES,
  type PilotCohortOutcome,
  type PilotDimensionScores,
  type PilotParticipantRow,
  type PilotReadiness,
  type PilotRoleFit,
} from './types';

type SubmissionLike = {
  student_id: string;
  assignment_id: string;
  status: string;
};

/** How many scoped assignments have at least one completed submission by this student. */
export function countCompletedAssignmentsInScope(
  studentId: string,
  submissions: SubmissionLike[],
  assignmentIdsInScope: string[],
): number {
  if (assignmentIdsInScope.length === 0) return 0;
  const scopeSet = new Set(assignmentIdsInScope);
  const done = new Set<string>();
  for (const s of submissions) {
    if (s.student_id !== studentId) continue;
    if (!scopeSet.has(s.assignment_id)) continue;
    if (s.status !== 'completed') continue;
    done.add(s.assignment_id);
  }
  return done.size;
}

/** Weighted 0-100 readiness score (30/25/20/15/10 model). */
export function computeWeightedScore(dimensions: PilotDimensionScores): number {
  let total = 0;
  for (const key of PILOT_DIMENSION_KEYS) {
    total += (dimensions[key] ?? 0) * PILOT_DIMENSION_WEIGHTS[key];
  }
  return Math.round(total);
}

export function buildParticipantRow(input: {
  id: string;
  name: string;
  completedInScope: number;
  assignmentsInScope: number;
  assessment: PilotParticipantAssessmentResult | null;
}): PilotParticipantRow {
  const { assessment } = input;
  if (!assessment) {
    return {
      id: input.id,
      name: input.name,
      completedInScope: input.completedInScope,
      assignmentsInScope: input.assignmentsInScope,
      assessed: false,
      dimensions: null,
      weightedScore: null,
      readiness: null,
      roleFit: null,
      keyStrength: '',
      mainRisk: '',
      nextAction: '',
      confidence: null,
      whyBullets: [],
    };
  }

  return {
    id: input.id,
    name: input.name,
    completedInScope: input.completedInScope,
    assignmentsInScope: input.assignmentsInScope,
    assessed: true,
    dimensions: assessment.dimensions,
    weightedScore: computeWeightedScore(assessment.dimensions),
    readiness: assessment.readiness,
    roleFit: assessment.roleFit,
    keyStrength: assessment.keyStrength,
    mainRisk: assessment.mainRisk,
    nextAction: assessment.nextAction,
    confidence: assessment.confidence,
    whyBullets: assessment.whyBullets,
  };
}

/** Aggregates assessed rows only; failed rows count toward participantsTotal. */
export function buildCohortOutcome(participants: PilotParticipantRow[]): PilotCohortOutcome {
  const readinessCounts = Object.fromEntries(
    PILOT_READINESS_VALUES.map((v) => [v, 0]),
  ) as Record<PilotReadiness, number>;
  const roleFitCounts = Object.fromEntries(
    PILOT_ROLE_FIT_VALUES.map((v) => [v, 0]),
  ) as Record<PilotRoleFit, number>;

  const assessed = participants.filter((p) => p.assessed);

  for (const p of assessed) {
    if (p.readiness) readinessCounts[p.readiness] += 1;
    if (p.roleFit) roleFitCounts[p.roleFit] += 1;
  }

  let meanDimensions: PilotDimensionScores | null = null;
  const withDims = assessed.filter((p) => p.dimensions != null);
  if (withDims.length > 0) {
    meanDimensions = {} as PilotDimensionScores;
    for (const key of PILOT_DIMENSION_KEYS) {
      const sum = withDims.reduce((acc, p) => acc + (p.dimensions![key] ?? 0), 0);
      meanDimensions[key] = Math.round(sum / withDims.length);
    }
  }

  return {
    participantsAssessed: assessed.length,
    participantsTotal: participants.length,
    readinessCounts,
    roleFitCounts,
    meanDimensions,
  };
}

/** Template fallback when the cohort AI summary fails. `{{ready}}`, `{{coachOrTraining}}`, `{{redirect}}` placeholders. */
export function fillRecommendationFallback(
  template: string,
  counts: Record<PilotReadiness, number>,
): string {
  return template
    .replace(/\{\{ready\}\}/g, String(counts.ready))
    .replace(/\{\{coachOrTraining\}\}/g, String(counts.coach + counts.not_ready))
    .replace(/\{\{redirect\}\}/g, String(counts.redirect));
}

const READINESS_SORT_ORDER: Record<PilotReadiness, number> = {
  ready: 0,
  coach: 1,
  redirect: 2,
  not_ready: 3,
};

/** Decision table order: ready → coach → redirect → not_ready → not assessed, then name. */
export function sortParticipantsForDecision(rows: PilotParticipantRow[]): PilotParticipantRow[] {
  return [...rows].sort((a, b) => {
    const aOrder = a.assessed && a.readiness != null ? READINESS_SORT_ORDER[a.readiness] : 99;
    const bOrder = b.assessed && b.readiness != null ? READINESS_SORT_ORDER[b.readiness] : 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/** One-line role-fit distribution for the executive summary (non-zero counts only). */
export function buildRoleFitDistributionLine(
  counts: Record<PilotRoleFit, number>,
  labels: Record<PilotRoleFit, string>,
): string {
  return PILOT_ROLE_FIT_VALUES.filter((k) => counts[k] > 0)
    .map((k) => `${labels[k]}: ${counts[k]}`)
    .join(' · ');
}

export function countNotAssessed(participants: PilotParticipantRow[]): number {
  return participants.filter((p) => !p.assessed).length;
}

/** Format classroom start/end dates for the scope line. */
export function formatPilotDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  locale: string,
): string | undefined {
  if (!startDate && !endDate) return undefined;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  if (startDate && endDate) return `${fmt(startDate)} – ${fmt(endDate)}`;
  if (startDate) return fmt(startDate);
  return endDate ? fmt(endDate) : undefined;
}
