/**
 * Validation and normalization for rubric-based evaluation AI output.
 */

export const EVAL_DIMENSION_KEYS = [
  'vision',
  'values',
  'thinking',
  'connection',
  'action',
] as const;

export type EvalDimensionKey = (typeof EVAL_DIMENSION_KEYS)[number];

export type EvalScoresRecord = Record<EvalDimensionKey, number | null>;

export type EvalScoreExplanations = Record<EvalDimensionKey, string>;

export interface RawDimensionPayload {
  level?: number | null;
  score?: number | null;
  notAssessableReason?: string | null;
  evidence?: string[];
  explanation?: string;
}

export interface RawEvaluationPayload {
  assignmentChecklist?: string[];
  dimensions?: Partial<Record<EvalDimensionKey, RawDimensionPayload>>;
  studentFeedback?: string;
  teacherFeedback?: string;
  /** Legacy flat shape fallback */
  scores?: Partial<Record<EvalDimensionKey, number | null>>;
  scoreExplanations?: Partial<Record<EvalDimensionKey, string>>;
}

export interface NormalizedEvaluation {
  assignmentChecklist: string[];
  scores: EvalScoresRecord;
  scoreExplanations: EvalScoreExplanations;
  evidence: Partial<Record<EvalDimensionKey, string[]>>;
  studentFeedback: string;
  teacherFeedback: string;
}

/** Map rubric level 1–5 to stored 1–10 score. */
export function levelToScore(level: number): number {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  return clamped * 2;
}

export function clampScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(10, Math.max(1, Math.round(n)));
}

const SHORT_QUOTE_MAX_LEN = 6;

export function normalizeForEvidenceMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Check if a quote appears in source (case-insensitive, punctuation-insensitive). */
export function evidenceQuoteInSource(quote: string, sourceText: string): boolean {
  const q = normalizeForEvidenceMatch(quote);
  const s = normalizeForEvidenceMatch(sourceText);
  if (!q) return false;

  if (q.length <= SHORT_QUOTE_MAX_LEN) {
    const pattern = new RegExp(`(?:^|\\s)${escapeRegexLiteral(q)}(?:\\s|$)`, 'u');
    return pattern.test(s);
  }

  return s.includes(q);
}

export function normalizeDimension(
  raw: RawDimensionPayload | undefined,
  sourceText: string,
  requireEvidence: boolean,
): {
  score: number | null;
  explanation: string;
  evidence: string[];
} {
  if (!raw) {
    return { score: null, explanation: '', evidence: [] };
  }

  const notAssessable = raw.notAssessableReason?.trim();
  if (notAssessable && (raw.level == null && raw.score == null)) {
    return {
      score: null,
      explanation: notAssessable,
      evidence: [],
    };
  }

  let score = clampScore(raw.score);
  if (score === null && typeof raw.level === 'number' && Number.isFinite(raw.level)) {
    score = levelToScore(raw.level);
  }

  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence.filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
    : [];

  if (requireEvidence && sourceText.trim().length > 0 && score !== null) {
    const verified = evidence.filter((q) => evidenceQuoteInSource(q, sourceText));
    return {
      score,
      explanation: raw.explanation?.trim() || '',
      evidence: verified,
    };
  }

  return {
    score,
    explanation: raw.explanation?.trim() || raw.notAssessableReason?.trim() || '',
    evidence,
  };
}

export function normalizeEvaluationPayload(
  raw: RawEvaluationPayload,
  sourceText: string,
  options: { requireEvidence?: boolean; isTeacherReview?: boolean } = {},
): NormalizedEvaluation {
  const requireEvidence = options.requireEvidence !== false && !options.isTeacherReview;

  const scores: EvalScoresRecord = {
    vision: null,
    values: null,
    thinking: null,
    connection: null,
    action: null,
  };
  const scoreExplanations: EvalScoreExplanations = {
    vision: '',
    values: '',
    thinking: '',
    connection: '',
    action: '',
  };
  const evidence: Partial<Record<EvalDimensionKey, string[]>> = {};

  if (raw.dimensions) {
    for (const key of EVAL_DIMENSION_KEYS) {
      const dim = normalizeDimension(raw.dimensions[key], sourceText, requireEvidence);
      scores[key] = dim.score;
      scoreExplanations[key] = dim.explanation;
      if (dim.evidence.length > 0) {
        evidence[key] = dim.evidence;
      }
    }
  } else if (raw.scores) {
    for (const key of EVAL_DIMENSION_KEYS) {
      scores[key] = clampScore(raw.scores[key]);
      scoreExplanations[key] = raw.scoreExplanations?.[key]?.trim() || '';
    }
  }

  return {
    assignmentChecklist: Array.isArray(raw.assignmentChecklist)
      ? raw.assignmentChecklist.filter((x): x is string => typeof x === 'string')
      : [],
    scores,
    scoreExplanations,
    evidence,
    studentFeedback: typeof raw.studentFeedback === 'string' ? raw.studentFeedback.trim() : '',
    teacherFeedback: typeof raw.teacherFeedback === 'string' ? raw.teacherFeedback.trim() : '',
  };
}

export interface RawHardSkillAssessment {
  skill_component?: string;
  current_level_percent?: number;
  proficiency_description?: string;
  actionable_challenge?: string;
  evidence?: string[];
}

export function normalizeHardSkillsAssessment(
  items: RawHardSkillAssessment[] | undefined,
): Array<{
  skill_component: string;
  current_level_percent: number;
  proficiency_description: string;
  actionable_challenge: string;
}> {
  if (!Array.isArray(items)) return [];
  return items
    .filter((a) => typeof a.skill_component === 'string' && a.skill_component.trim())
    .map((a) => ({
      skill_component: a.skill_component!.trim(),
      current_level_percent: Math.min(
        100,
        Math.max(0, Math.round(Number(a.current_level_percent) || 0)),
      ),
      proficiency_description:
        typeof a.proficiency_description === 'string' ? a.proficiency_description.trim() : '',
      actionable_challenge:
        typeof a.actionable_challenge === 'string' ? a.actionable_challenge.trim() : '',
    }));
}

/** Mean of non-null dimension scores (for analytics). */
export function meanNonNullScores(scores: EvalScoresRecord | Record<string, number | null>): number | null {
  let sum = 0;
  let n = 0;
  for (const key of EVAL_DIMENSION_KEYS) {
    const v = scores[key];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return n === 0 ? null : sum / n;
}
