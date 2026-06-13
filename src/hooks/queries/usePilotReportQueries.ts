import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnalyticsModuleFilter } from '@/lib/analyticsScope';
import type { PilotReportAnalyticsData } from '@/lib/pilotReport/computePilotReportDataHash';
import {
  ensurePilotReportSnapshot,
  getPilotReportSnapshot,
  invalidatePilotReportSnapshots,
  deletePilotReportSnapshot,
  type EnsurePilotReportSnapshotInput,
  type PilotReportSnapshot,
} from '@/services/pilotReportCacheService';

export const pilotReportKeys = {
  all: ['pilotReport'] as const,
  snapshot: (
    classroomId: string,
    scopeModule: AnalyticsModuleFilter,
    scopeAssignment: string,
    language: 'en' | 'he',
  ) =>
    [...pilotReportKeys.all, 'snapshot', classroomId, scopeModule, scopeAssignment, language] as const,
};

export function usePilotReportSnapshot(
  classroomId: string | undefined,
  scopeModule: AnalyticsModuleFilter,
  scopeAssignment: string,
  language: 'en' | 'he',
) {
  return useQuery<PilotReportSnapshot | null>({
    queryKey: pilotReportKeys.snapshot(classroomId || '', scopeModule, scopeAssignment, language),
    queryFn: async () => {
      if (!classroomId) return null;
      return getPilotReportSnapshot({
        classroomId,
        scopeModule,
        scopeAssignment,
        language,
      });
    },
    enabled: !!classroomId,
    staleTime: 30 * 1000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' ? 2000 : false;
    },
  });
}

export function useEnsurePilotReportSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EnsurePilotReportSnapshotInput) => ensurePilotReportSnapshot(input),
    onSuccess: (data, variables) => {
      if (!data) return;
      queryClient.setQueryData(
        pilotReportKeys.snapshot(
          variables.classroomId,
          variables.scopeModule,
          variables.scopeAssignment,
          variables.language,
        ),
        data,
      );
    },
  });
}

export function useInvalidatePilotReportSnapshots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (classroomId: string) => invalidatePilotReportSnapshots(classroomId),
    onSuccess: (_data, classroomId) => {
      queryClient.invalidateQueries({
        queryKey: [...pilotReportKeys.all, 'snapshot', classroomId],
      });
    },
  });
}

export function useDeletePilotReportSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      classroomId: string;
      scopeModule: AnalyticsModuleFilter;
      scopeAssignment: string;
      language: 'en' | 'he';
    }) => deletePilotReportSnapshot(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: pilotReportKeys.snapshot(
          variables.classroomId,
          variables.scopeModule,
          variables.scopeAssignment,
          variables.language,
        ),
      });
    },
  });
}

export type { PilotReportSnapshot, EnsurePilotReportSnapshotInput, PilotReportAnalyticsData };
