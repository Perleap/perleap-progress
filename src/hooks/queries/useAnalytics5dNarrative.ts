import { useQuery } from '@tanstack/react-query';
import { hashEvidenceKey } from '@/lib/analytics5dEvidence';
import {
  invokeExplainAnalytics5d,
  type Analytics5dNarrativeContext,
  type Analytics5dNarrativeInput,
  type Analytics5dNarrativeResult,
} from '@/services/analytics5dExplainService';
import type { FiveDScores } from '@/types/models';

export type { Analytics5dNarrativeContext, Analytics5dNarrativeInput, Analytics5dNarrativeResult };

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
      input.brief ? 'brief' : 'full',
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
        return { explanations: null, scopeSummary: null, strengths: [], weaknesses: [], nextSteps: [] };
      }
      return invokeExplainAnalytics5d(input);
    },
    enabled: options.enabled && !!input?.classroomId,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
