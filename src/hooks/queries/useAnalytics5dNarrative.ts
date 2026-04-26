import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { evidenceSourceNoteForBundle, hashEvidenceKey } from '@/lib/analytics5dEvidence';
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
  /** Capped text bundle for the LLM; cache key includes a hash of this string. */
  evidenceText?: string;
  /** Excerpt count from `build5dNarrativeEvidence` (for edge observability; no PII). */
  evidenceSourceCount?: number;
}

export interface Analytics5dNarrativeResult {
  explanations: Partial<Record<keyof FiveDScores, string>> | null;
  scopeSummary: string | null;
}

const FIVED_KEYS: (keyof FiveDScores)[] = ['vision', 'values', 'thinking', 'connection', 'action'];

function stableScoreKey(s: FiveDScores): string {
  return FIVED_KEYS.map((k) => s[k].toFixed(2)).join(',');
}

export const analytics5dNarrativeKeys = {
  all: ['analytics5dNarrative'] as const,
  one: (input: Analytics5dNarrativeInput & { narrativeId: string }) =>
    [
      ...analytics5dNarrativeKeys.all,
      input.narrativeId,
      input.classroomId,
      input.context,
      input.language,
      input.filterSummary,
      input.studentName ?? '',
      input.compareLabelA ?? '',
      input.compareLabelB ?? '',
      stableScoreKey(input.scores),
      input.peerScores ? stableScoreKey(input.peerScores) : '',
      input.evidenceText != null && input.evidenceText !== ''
        ? hashEvidenceKey(input.evidenceText)
        : 'no-evidence',
    ] as const,
};

export function useAnalytics5dNarrative(
  input: Analytics5dNarrativeInput | null,
  options: { enabled: boolean; narrativeId: string },
) {
  return useQuery<Analytics5dNarrativeResult>({
    queryKey: input
      ? analytics5dNarrativeKeys.one({ ...input, narrativeId: options.narrativeId })
      : ['analytics5dNarrative', 'disabled', options.narrativeId],
    queryFn: async () => {
      if (!input) {
        return { explanations: null, scopeSummary: null };
      }

      const { data, error } = await supabase.functions.invoke<{
        explanations: Record<keyof FiveDScores, string>;
        scopeSummary: string;
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
                ...(input.evidenceSourceCount != null
                  ? { evidenceSourceCount: input.evidenceSourceCount }
                  : {}),
              }
            : {}),
        },
      });

      if (error) {
        throw error;
      }
      const d = data as { explanations?: unknown; scopeSummary?: string; error?: string } | null;
      if (d && typeof d === 'object' && 'error' in d && d.error) {
        throw new Error(String(d.error));
      }
      if (!d?.explanations) {
        return { explanations: null, scopeSummary: d?.scopeSummary ?? null };
      }
      return {
        explanations: d.explanations as Partial<Record<keyof FiveDScores, string>>,
        scopeSummary: d.scopeSummary ?? null,
      };
    },
    enabled: options.enabled && !!input?.classroomId,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
