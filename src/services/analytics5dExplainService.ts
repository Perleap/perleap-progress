import { supabase } from '@/integrations/supabase/client';
import { evidenceSourceNoteForBundle } from '@/lib/analytics5dEvidence';
import { INCLUDE_TEACHER_5D_EVIDENCE } from '@/config/constants';
import type { FiveDScores } from '@/types/models';

export type Analytics5dNarrativeContext = 'class_avg' | 'student_avg' | 'module_compare';

export interface Analytics5dNarrativeInput {
  classroomId: string;
  context: Analytics5dNarrativeContext;
  language: 'en' | 'he';
  scores: FiveDScores;
  filterSummary: string;
  studentName?: string;
  compareLabelA?: string;
  compareLabelB?: string;
  peerScores?: FiveDScores;
  evidenceText?: string;
  evidenceSourceCount?: number;
}

export interface Analytics5dNarrativeResult {
  explanations: Partial<Record<keyof FiveDScores, string>> | null;
  scopeSummary: string | null;
  strengths?: string[];
  weaknesses?: string[];
  nextSteps?: string[];
}

/**
 * Calls `explain-analytics-5d`. Shared by React Query hooks and exporters (lesson brief PDF).
 */
export async function invokeExplainAnalytics5d(
  input: Analytics5dNarrativeInput,
): Promise<Analytics5dNarrativeResult> {
  const { data, error } = await supabase.functions.invoke<{
    explanations: Record<keyof FiveDScores, string>;
    scopeSummary: string;
    strengths?: string[];
    weaknesses?: string[];
    nextSteps?: string[];
    error?: string;
  }>('explain-analytics-5d', {
    body: {
      classroomId: input.classroomId,
      context: input.context,
      language: input.language,
      scores: input.scores,
      filterSummary: input.filterSummary,
      studentName: input.studentName,
      compareLabelA: input.compareLabelA,
      compareLabelB: input.compareLabelB,
      peerScores: input.peerScores,
      ...(input.evidenceText && input.evidenceText.trim()
        ? {
            evidenceText: input.evidenceText,
            evidenceSourceNote: evidenceSourceNoteForBundle(INCLUDE_TEACHER_5D_EVIDENCE),
            ...(input.evidenceSourceCount != null ? { evidenceSourceCount: input.evidenceSourceCount } : {}),
          }
        : {}),
    },
  });

  if (error) {
    throw error;
  }
  const d = data as { explanations?: unknown; scopeSummary?: string; strengths?: string[]; weaknesses?: string[]; nextSteps?: string[]; error?: string } | null;
  if (d && typeof d === 'object' && 'error' in d && d.error) {
    throw new Error(String(d.error));
  }
  if (!d?.explanations) {
    return { explanations: null, scopeSummary: d?.scopeSummary ?? null, strengths: d?.strengths, weaknesses: d?.weaknesses, nextSteps: d?.nextSteps };
  }
  return {
    explanations: d.explanations as Partial<Record<keyof FiveDScores, string>>,
    scopeSummary: d.scopeSummary ?? null,
    strengths: d.strengths,
    weaknesses: d.weaknesses,
    nextSteps: d.nextSteps,
  };
}
