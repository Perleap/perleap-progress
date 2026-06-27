import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { EvaluationRefreshProgressBanner } from '@/components/features/analytics/EvaluationRefreshProgressBanner';
import {
  estimateRefreshDurationSeconds,
  estimateSecondsPerStudent,
  formatEta,
} from '@/lib/evaluationRefreshEstimate';

export type EvaluationRefreshActiveJob = {
  jobId: string;
  classroomId: string;
  percent: number;
  progressLabel: string;
  etaLabel: string;
  totalStudents: number;
  completedStudents: number;
  isCancelling: boolean;
};

export type RefreshResponse = {
  status: 'completed' | 'cancelled' | 'failed' | 'empty';
  batchId?: string | null;
  updated?: number;
  skipped?: number;
  failed?: number;
  manualSkipped?: number;
  canUndo?: boolean;
  error?: string;
};

type EvaluationRefreshProcessingContextValue = {
  activeJob: EvaluationRefreshActiveJob | null;
  isRefreshing: boolean;
  startRefresh: (classroomId: string) => Promise<RefreshResponse | { error: string }>;
  cancelRefresh: () => Promise<void>;
};

const EvaluationRefreshProcessingContext =
  createContext<EvaluationRefreshProcessingContextValue | null>(null);

const POLL_MS = 1000;
const COMPLETE_PAUSE_MS = 400;
const PROGRESS_CAP = 95;

type JobRow = {
  status: string;
  completed_students: number;
  total_students: number;
  total_submissions: number;
  batch_id: string | null;
  error_message: string | null;
};

type StartResponse = {
  jobId?: string;
  totalStudents?: number;
  totalSubmissions?: number;
  manualSkipped?: number;
  skipped?: number;
  updated?: number;
  batchId?: string | null;
  failed?: number;
  error?: string;
};

function jobToRefreshResponse(job: JobRow, manualSkipped = 0, skipped = 0): RefreshResponse {
  if (job.status === 'completed') {
    return {
      status: 'completed',
      batchId: job.batch_id,
      updated: job.total_submissions,
      skipped,
      failed: 0,
      manualSkipped,
      canUndo: !!job.batch_id,
    };
  }
  if (job.status === 'cancelled') {
    return { status: 'cancelled' };
  }
  return {
    status: 'failed',
    error: job.error_message ?? 'Refresh failed',
  };
}

export function EvaluationRefreshProcessingProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [activeJob, setActiveJob] = useState<EvaluationRefreshActiveJob | null>(null);
  const pollRef = useRef<number | null>(null);
  const jobMetaRef = useRef({ manualSkipped: 0, skipped: 0, secondsPerStudent: 28 });
  const isCancellingRef = useRef(false);

  const clearPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const clearJob = useCallback(() => {
    clearPoll();
    isCancellingRef.current = false;
    setActiveJob(null);
  }, [clearPoll]);

  const updateJobFromRow = useCallback(
    (jobId: string, classroomId: string, row: JobRow) => {
      const { total_students: totalStudents, completed_students: completedStudents } = row;
      const { secondsPerStudent } = jobMetaRef.current;

      const computePercent =
        row.status === 'completed'
          ? 100
          : Math.min(
              PROGRESS_CAP,
              totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0,
            );

      const remainingStudents = Math.max(0, totalStudents - completedStudents);
      const remainingSeconds = remainingStudents * secondsPerStudent;

      setActiveJob({
        jobId,
        classroomId,
        percent: computePercent,
        totalStudents,
        completedStudents,
        isCancelling: isCancellingRef.current,
        progressLabel: t('analytics.refreshProgress.label', {
          current: completedStudents,
          total: totalStudents,
        }),
        etaLabel:
          row.status === 'running' && remainingSeconds > 0
            ? t('analytics.refreshProgress.eta', { time: formatEta(remainingSeconds) })
            : '',
      });
    },
    [t],
  );

  const waitForTerminalJob = useCallback(
    (jobId: string, classroomId: string, manualSkipped: number, skipped: number) =>
      new Promise<RefreshResponse>((resolve, reject) => {
        jobMetaRef.current = { ...jobMetaRef.current, manualSkipped, skipped };

        const poll = async () => {
          try {
            const { data, error } = await supabase
              .from('evaluation_refresh_jobs')
              .select(
                'status, completed_students, total_students, total_submissions, batch_id, error_message',
              )
              .eq('id', jobId)
              .single();

            if (error) throw error;
            if (!data) throw new Error('Job not found');

            const row = data as JobRow;
            updateJobFromRow(jobId, classroomId, row);

            if (row.status === 'running') return;

            clearPoll();
            isCancellingRef.current = false;
            updateJobFromRow(jobId, classroomId, row);

            await new Promise<void>((r) => {
              window.setTimeout(r, COMPLETE_PAUSE_MS);
            });
            clearJob();

            resolve(jobToRefreshResponse(row, manualSkipped, skipped));
          } catch (e) {
            clearPoll();
            clearJob();
            reject(e);
          }
        };

        void poll();
        pollRef.current = window.setInterval(() => {
          void poll();
        }, POLL_MS);
      }),
    [clearJob, clearPoll, updateJobFromRow],
  );

  const startRefresh = useCallback(
    async (classroomId: string): Promise<RefreshResponse | { error: string }> => {
      clearJob();

      try {
        const { data, error } = await supabase.functions.invoke<StartResponse>(
          'refresh-class-evaluations',
          { body: { classroomId } },
        );

        if (error) {
          return { error: error.message || 'invoke_failed' };
        }

        const payload = data ?? {};

        if (payload.error) {
          return { error: payload.error };
        }

        if (!payload.jobId) {
          return {
            status: 'empty',
            batchId: payload.batchId ?? null,
            updated: payload.updated ?? 0,
            skipped: payload.skipped ?? 0,
            failed: payload.failed ?? 0,
            manualSkipped: payload.manualSkipped ?? 0,
          };
        }

        const totalStudents = payload.totalStudents ?? 0;
        const totalSubmissions = payload.totalSubmissions ?? totalStudents;
        const manualSkipped = payload.manualSkipped ?? 0;
        const skipped = payload.skipped ?? 0;

        jobMetaRef.current = {
          manualSkipped,
          skipped,
          secondsPerStudent: estimateSecondsPerStudent(totalStudents, totalSubmissions),
        };

        setActiveJob({
          jobId: payload.jobId,
          classroomId,
          percent: 0,
          totalStudents,
          completedStudents: 0,
          isCancelling: false,
          progressLabel: t('analytics.refreshProgress.label', {
            current: 0,
            total: totalStudents,
          }),
          etaLabel: t('analytics.refreshProgress.eta', {
            time: formatEta(estimateRefreshDurationSeconds(totalStudents, totalSubmissions)),
          }),
        });

        return await waitForTerminalJob(payload.jobId, classroomId, manualSkipped, skipped);
      } catch (e) {
        clearJob();
        return { error: e instanceof Error ? e.message : 'invoke_failed' };
      }
    },
    [clearJob, t, waitForTerminalJob],
  );

  const cancelRefresh = useCallback(async () => {
    if (!activeJob) return;

    isCancellingRef.current = true;
    setActiveJob((job) => (job ? { ...job, isCancelling: true } : job));

    await supabase.functions.invoke('cancel-evaluation-refresh', {
      body: { classroomId: activeJob.classroomId, jobId: activeJob.jobId },
    });
  }, [activeJob]);

  const value = useMemo(
    (): EvaluationRefreshProcessingContextValue => ({
      activeJob,
      isRefreshing: activeJob !== null,
      startRefresh,
      cancelRefresh,
    }),
    [activeJob, startRefresh, cancelRefresh],
  );

  return (
    <EvaluationRefreshProcessingContext.Provider value={value}>
      {children}
      {activeJob ? <EvaluationRefreshProgressBanner job={activeJob} /> : null}
    </EvaluationRefreshProcessingContext.Provider>
  );
}

export function useEvaluationRefreshProcessing(): EvaluationRefreshProcessingContextValue {
  const ctx = useContext(EvaluationRefreshProcessingContext);
  if (!ctx) {
    throw new Error(
      'useEvaluationRefreshProcessing must be used within EvaluationRefreshProcessingProvider',
    );
  }
  return ctx;
}
