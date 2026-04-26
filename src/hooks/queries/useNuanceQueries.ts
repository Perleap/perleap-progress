import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NuanceMetric {
  student_id: string;
  assignment_id: string;
  classroom_id: string;
  avg_response_latency_ms: number | null;
  total_idle_time_ms: number;
  idle_ratio: number;
  completion_status: string;
  focus_loss_count: number;
  resume_count: number;
  session_count: number;
  total_session_duration_ms: number;
  first_interaction_latency_ms: number | null;
  /** Count of in-chat "understanding" cues; optional for older API/cache rows. */
  understanding_cue_count?: number;
}

export interface NuanceRecommendation {
  student_id: string;
  classroom_id: string;
  recommendation_type: string;
  trigger_reason: string;
  confidence_score: number;
  recommendation_text: string;
  supporting_metrics: Record<string, unknown>;
  generated_at?: string;
}

export interface NuanceInsightsResponse {
  metrics: NuanceMetric[];
  recommendations: NuanceRecommendation[];
  baselines: {
    class: {
      avg_latency: number;
      avg_idle_ratio: number;
      avg_completion_rate: number;
      assignment_count: number;
    };
  };
  cached?: boolean;
}

export const nuanceKeys = {
  all: ['nuance'] as const,
  insights: (classroomId: string) => [...nuanceKeys.all, 'insights', classroomId] as const,
  understandingCueEvents: (studentId: string, scopeKey: string) =>
    [...nuanceKeys.all, 'understandingCues', studentId, scopeKey] as const,
};

export interface NuanceUnderstandingCueEventRow {
  id: string;
  created_at: string;
  assignment_id: string;
  metadata: {
    reason_codes?: string[];
    locale_hint?: string;
    message_index?: number;
    length_bucket?: string;
    [key: string]: unknown;
  } | null;
}

/** Teacher-visible raw understanding_cue events (no message text; RLS on student_nuance_events). */
export function useNuanceUnderstandingCueEvents(
  studentId: string | undefined,
  assignmentIdsInScope: string[],
  enabled: boolean,
) {
  const scopeKey = [...assignmentIdsInScope].sort().join(',') || '_';
  return useQuery({
    queryKey: nuanceKeys.understandingCueEvents(studentId || '', scopeKey),
    queryFn: async () => {
      if (!studentId || assignmentIdsInScope.length === 0) return [] as NuanceUnderstandingCueEventRow[];
      const { data, error } = await supabase
        .from('student_nuance_events')
        .select('id, created_at, assignment_id, metadata')
        .eq('student_id', studentId)
        .eq('event_type', 'understanding_cue')
        .in('assignment_id', assignmentIdsInScope)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as NuanceUnderstandingCueEventRow[];
    },
    enabled: Boolean(enabled && studentId && assignmentIdsInScope.length > 0),
    staleTime: 15_000,
  });
}

export const useNuanceInsights = (classroomId: string | undefined) => {
  return useQuery<NuanceInsightsResponse>({
    queryKey: nuanceKeys.insights(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');

      const { data, error } = await supabase.functions.invoke('compute-nuance-insights', {
        body: { classroom_id: classroomId },
      });

      if (error) throw error;
      return data as NuanceInsightsResponse;
    },
    enabled: !!classroomId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};
