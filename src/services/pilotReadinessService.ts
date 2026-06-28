import { supabase } from '@/integrations/supabase/client';
import type { FiveDScores } from '@/types/models';
import type {
  PilotConfidence,
  PilotDimensionScores,
  PilotReadiness,
  PilotRoleFit,
} from '@/lib/pilotReport/types';
import {
  PILOT_CONFIDENCE_VALUES,
  PILOT_DIMENSION_KEYS,
  PILOT_READINESS_VALUES,
  PILOT_ROLE_FIT_VALUES,
} from '@/lib/pilotReport/types';

export interface PilotParticipantAssessmentInput {
  classroomId: string;
  language: 'en' | 'he';
  participantName: string;
  fiveDScores: FiveDScores | null;
  completionSummary: string;
  hardSkillsSummary: string;
  evidenceText?: string;
}

export interface PilotParticipantAssessmentResult {
  dimensions: PilotDimensionScores;
  readiness: PilotReadiness;
  roleFit: PilotRoleFit;
  keyStrength: string;
  mainRisk: string;
  nextAction: string;
  confidence: PilotConfidence;
  placementPriority: number;
  whyBullets: string[];
}

export interface PilotCohortSummaryInput {
  classroomId: string;
  language: 'en' | 'he';
  participantCount: number;
  readinessCounts: Record<PilotReadiness, number>;
  roleFitCounts: Record<PilotRoleFit, number>;
  meanDimensions: PilotDimensionScores;
}

export interface PilotCohortSummaryResult {
  recommendation: string;
  strongestCapability: string;
  mainGap: string;
  topNextAction: string;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function clamp0to100(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampPriority(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseWhyBullets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => (s as string).trim())
    .slice(0, 3);
}

export async function invokePilotReadiness(
  input: PilotParticipantAssessmentInput,
): Promise<PilotParticipantAssessmentResult> {
  const { data, error } = await supabase.functions.invoke<Record<string, unknown>>(
    'pilot-readiness',
    {
      body: {
        mode: 'participant',
        classroomId: input.classroomId,
        language: input.language,
        participantName: input.participantName,
        fiveDScores: input.fiveDScores ?? undefined,
        completionSummary: input.completionSummary,
        hardSkillsSummary: input.hardSkillsSummary,
        ...(input.evidenceText && input.evidenceText.trim()
          ? { evidenceText: input.evidenceText }
          : {}),
      },
    },
  );

  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }

  const rawDims = (data?.dimensions ?? {}) as Record<string, unknown>;
  const dimensions = {} as PilotDimensionScores;
  for (const key of PILOT_DIMENSION_KEYS) {
    dimensions[key] = clamp0to100(rawDims[key]);
  }

  return {
    dimensions,
    readiness: pickEnum(data?.readiness, PILOT_READINESS_VALUES, 'not_ready'),
    roleFit: pickEnum(data?.roleFit, PILOT_ROLE_FIT_VALUES, 'training'),
    keyStrength: cleanText(data?.keyStrength),
    mainRisk: cleanText(data?.mainRisk),
    nextAction: cleanText(data?.nextAction),
    confidence: pickEnum(data?.confidence, PILOT_CONFIDENCE_VALUES, 'low'),
    placementPriority: clampPriority(data?.placementPriority),
    whyBullets: parseWhyBullets(data?.whyBullets),
  };
}

export async function invokePilotCohortSummary(
  input: PilotCohortSummaryInput,
): Promise<PilotCohortSummaryResult> {
  const { data, error } = await supabase.functions.invoke<Record<string, unknown>>(
    'pilot-readiness',
    {
      body: {
        mode: 'cohort',
        classroomId: input.classroomId,
        language: input.language,
        participantCount: input.participantCount,
        readinessCounts: input.readinessCounts,
        roleFitCounts: input.roleFitCounts,
        meanDimensions: input.meanDimensions,
      },
    },
  );

  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }

  return {
    recommendation: cleanText(data?.recommendation),
    strongestCapability: cleanText(data?.strongestCapability),
    mainGap: cleanText(data?.mainGap),
    topNextAction: cleanText(data?.topNextAction),
  };
}
