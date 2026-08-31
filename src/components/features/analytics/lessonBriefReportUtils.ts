import type { Analytics5dNarrativeResult } from '@/services/analytics5dExplainService';
import type { FiveDScores, FiveDQedMeasures } from '@/types/models';
import type { TFunction } from 'i18next';

type SubmissionLike = {
  student_id: string;
  assignment_id: string;
  status: string;
};

export type StudentWithNarrative = {
  id: string;
  name: string;
  completedInScope: number;
  assignmentsInScope: number;
  scores: FiveDScores | null;
  qedMeasures: FiveDQedMeasures | null;
  narrative: Analytics5dNarrativeResult | null;
};

export type StudentStatusKey = 'highPriority' | 'needsSupport' | 'monitor' | 'stable';

export type DimensionKey = keyof FiveDScores;

type StudentNarrativeFields = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvement: string[];
};

export type StudentReportRow = StudentWithNarrative & {
  completionRatio: number;
  averageScore: number | null;
  weakestDimension: DimensionKey | null;
  weakestScore: number | null;
  status: StudentStatusKey;
  normalizedNarrative: StudentNarrativeFields;
};

export type ClassPriorityInsight = {
  title: string;
  body: string;
};

export const DIMENSION_ORDER: DimensionKey[] = [
  'vision',
  'values',
  'thinking',
  'connection',
  'action',
];

export const STATUS_PRIORITY_ORDER: Record<StudentStatusKey, number> = {
  highPriority: 0,
  needsSupport: 1,
  monitor: 2,
  stable: 3,
};

export const STATUS_I18N_KEY: Record<StudentStatusKey, string> = {
  highPriority: 'analytics.lessonBrief.statusHighPriority',
  needsSupport: 'analytics.lessonBrief.statusNeedsSupport',
  monitor: 'analytics.lessonBrief.statusMonitor',
  stable: 'analytics.lessonBrief.statusStable',
};

export const LESSON_BRIEF_POLL_MS = 500;
export const LESSON_BRIEF_POLL_TIMEOUT_MS = 60_000;

export function countStudentCompletedAssignmentsInScope(
  studentId: string,
  submissions: SubmissionLike[],
  assignmentIdsInScope: string[]
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

export function lessonBriefDownloadFilename(courseName: string | undefined | null): string {
  const shortName =
    (courseName || 'course')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'course';
  const date = new Date().toISOString().slice(0, 10);
  return `lesson_brief_${shortName}_${date}.html`;
}

export function safeScore(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return value;
}

export function averageFiveD(scores: FiveDScores): number {
  const total = DIMENSION_ORDER.reduce((sum, key) => sum + safeScore(scores[key]), 0);
  return total / DIMENSION_ORDER.length;
}

export function getWeakestDimension(scores: FiveDScores): { key: DimensionKey; value: number } {
  let weakest: DimensionKey = DIMENSION_ORDER[0];
  let weakestValue = safeScore(scores[weakest]);

  for (const key of DIMENSION_ORDER.slice(1)) {
    const value = safeScore(scores[key]);
    if (value < weakestValue) {
      weakest = key;
      weakestValue = value;
    }
  }

  return { key: weakest, value: weakestValue };
}

export function classifyStudentStatus(
  completionRatio: number,
  weakestScore: number
): StudentStatusKey {
  if (completionRatio < 0.35 || weakestScore < 3.5) return 'highPriority';
  if (completionRatio < 0.55 || weakestScore < 5) return 'needsSupport';
  if (completionRatio < 0.75 || weakestScore < 6.5) return 'monitor';
  return 'stable';
}

function asList(value: string[] | null | undefined): string[] {
  if (!value || value.length === 0) return [];
  return value.map((item) => item.trim()).filter(Boolean);
}

export function normalizeNarrative(
  narrative: Analytics5dNarrativeResult | null,
  studentName: string,
  weakestDimension: DimensionKey | null,
  t: TFunction
): StudentNarrativeFields {
  const summary =
    narrative?.scopeSummary?.trim() ||
    t('analytics.lessonBrief.defaultSummary', { name: studentName });

  const strengths = asList(narrative?.strengths);
  const weaknesses = asList(narrative?.weaknesses);
  const improvement = asList(narrative?.nextSteps);

  const weakestLabel = weakestDimension
    ? t(`dimensions.${weakestDimension}.label`)
    : t('analytics.lessonBrief.dash');

  return {
    summary,
    strengths: strengths.length > 0 ? strengths : [t('analytics.lessonBrief.defaultStrength')],
    weaknesses:
      weaknesses.length > 0
        ? weaknesses
        : [
            t('analytics.lessonBrief.defaultWeakness', {
              dimension: weakestLabel.toLowerCase(),
            }),
          ],
    improvement:
      improvement.length > 0
        ? improvement
        : [
            t('analytics.lessonBrief.defaultImprovement', {
              dimension: weakestLabel.toLowerCase(),
            }),
          ],
  };
}
