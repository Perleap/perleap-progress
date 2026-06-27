import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEvaluationRefreshProcessing } from '@/contexts/EvaluationRefreshProcessingContext';
import {
  estimateRefreshDurationSeconds,
  formatEta,
  getEligibleRefreshMeta,
} from '@/lib/evaluationRefreshEstimate';

interface RegenerateScoresButtonProps {
  classroomId: string;
  onComplete: () => void;
  compact?: boolean;
}

type UndoResponse = {
  restored: number;
  failed: number;
  canUndo?: boolean;
  error?: string;
};

export function RegenerateScoresButton({ classroomId, onComplete, compact = false }: RegenerateScoresButtonProps) {
  const { t } = useTranslation();
  const { isRefreshing, startRefresh } = useEvaluationRefreshProcessing();
  const [undoLoading, setUndoLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [eligibleStudents, setEligibleStudents] = useState<number | null>(null);
  const [eligibleSubmissions, setEligibleSubmissions] = useState<number | null>(null);

  const { data: hasUndoBatch, refetch: refetchUndoBatch } = useQuery({
    queryKey: ['evaluation-refresh-batch', classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluation_refresh_batches')
        .select('id')
        .eq('classroom_id', classroomId)
        .maybeSingle();

      if (error) throw error;
      return !!data?.id;
    },
    enabled: !!classroomId,
  });

  const { data: hasRunningJob } = useQuery({
    queryKey: ['evaluation-refresh-job-running', classroomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluation_refresh_jobs')
        .select('id')
        .eq('classroom_id', classroomId)
        .eq('status', 'running')
        .maybeSingle();

      if (error) throw error;
      return !!data?.id;
    },
    enabled: !!classroomId,
    refetchInterval: isRefreshing ? 2000 : false,
  });

  const canUndo = !!hasUndoBatch && !hasRunningJob && !isRefreshing;

  useEffect(() => {
    if (!confirmOpen || !classroomId) {
      setEligibleStudents(null);
      setEligibleSubmissions(null);
      return;
    }

    let cancelled = false;
    void getEligibleRefreshMeta(classroomId)
      .then((meta) => {
        if (!cancelled) {
          setEligibleStudents(meta.studentCount);
          setEligibleSubmissions(meta.submissionCount);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEligibleStudents(null);
          setEligibleSubmissions(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [confirmOpen, classroomId]);

  const refreshAllEvaluations = async () => {
    const result = await startRefresh(classroomId);

    if ('error' in result) {
      toast.error(t('analytics.refreshError'));
      return;
    }

    if (result.status === 'cancelled') {
      toast.info(t('analytics.refreshProgress.cancelled'));
      return;
    }

    if (result.status === 'failed') {
      toast.error(result.error ?? t('analytics.refreshError'));
      return;
    }

    if (result.status === 'empty') {
      if ((result.manualSkipped ?? 0) > 0 && (result.skipped ?? 0) === 0) {
        toast.info(t('analytics.refreshAllManualSkipped', { count: result.manualSkipped }));
      } else {
        toast.info(t('analytics.noCompletedSubmissions'));
      }
      return;
    }

    if ((result.updated ?? 0) > 0) {
      const parts = [t('analytics.refreshSuccess', { count: result.updated })];
      if ((result.manualSkipped ?? 0) > 0) {
        parts.push(t('analytics.refreshManualSkipped', { count: result.manualSkipped }));
      }
      toast.success(parts.join(' '));
      void refetchUndoBatch();
      onComplete();
    }
  };

  const undoRefresh = async () => {
    setUndoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<UndoResponse>(
        'undo-evaluation-refresh',
        { body: { classroomId } },
      );

      if (error) {
        throw error;
      }

      const result = data ?? { restored: 0, failed: 0 };

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.restored > 0) {
        toast.success(t('analytics.undoRefreshSuccess', { count: result.restored }));
        void refetchUndoBatch();
        onComplete();
      } else {
        toast.info(t('analytics.undoRefreshEmpty'));
      }

      if (result.failed > 0) {
        toast.error(t('analytics.undoRefreshFail', { count: result.failed }));
      }
    } catch {
      toast.error(t('analytics.undoRefreshError'));
    } finally {
      setUndoLoading(false);
    }
  };

  const confirmEstimate =
    eligibleStudents != null &&
    eligibleStudents > 0 &&
    eligibleSubmissions != null
      ? t('analytics.refreshProgress.confirmEstimate', {
          time: formatEta(
            estimateRefreshDurationSeconds(eligibleStudents, eligibleSubmissions),
          ),
          count: eligibleStudents,
        })
      : null;

  return (
    <>
      <div className={cn('flex items-center gap-2', compact && 'shrink-0')}>
        <Button
          type="button"
          variant="outline"
          size={compact ? 'sm' : 'default'}
          className={cn('rounded-lg', compact && 'shrink-0')}
          onClick={() => setConfirmOpen(true)}
          disabled={isRefreshing || undoLoading || !!hasRunningJob}
        >
          <RefreshCw
            className={cn('h-4 w-4 me-1.5', isRefreshing && 'animate-spin')}
            aria-hidden
          />
          {isRefreshing
            ? t('analytics.regeneratingScores')
            : compact
              ? t('analytics.refresh5D')
              : t('analytics.regenerateAll5DScores')}
        </Button>

        {canUndo ? (
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            className={cn('rounded-lg', compact && 'shrink-0')}
            onClick={() => void undoRefresh()}
            disabled={isRefreshing || undoLoading}
          >
            <Undo2
              className={cn('h-4 w-4 me-1.5', undoLoading && 'animate-pulse')}
              aria-hidden
            />
            {undoLoading ? t('analytics.undoingRefresh') : t('analytics.undoRefresh')}
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('analytics.regenerateScoresConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('analytics.regenerateScoresConfirmDescription')}
              {confirmEstimate ? ` ${confirmEstimate}` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void refreshAllEvaluations();
              }}
            >
              {t('analytics.regenerateScoresConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
