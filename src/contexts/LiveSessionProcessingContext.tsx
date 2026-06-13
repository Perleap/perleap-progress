import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import { buildRoute } from '@/config/routes';
import { LiveSessionProcessingBanner } from '@/components/features/liveSession/LiveSessionProcessingBanner';
import {
  runLiveSessionCreatePipeline,
  type LiveSessionPipelineProgress,
} from '@/services/liveSessionCreatePipeline';
import type { LiveSessionType, LiveSessionUploadMode } from '@/types/liveSession';

export type LiveSessionActiveJob = {
  classroomId: string;
  assignmentId: string | null;
  title: string;
  percent: number;
  progressLabel: string;
  transcriptionPhase: LiveSessionPipelineProgress['transcriptionPhase'] | null;
  chunkIndex?: number;
  chunkTotal?: number;
  minimized: boolean;
};

type StartJobInput = {
  classroomId: string;
  syllabusSectionId?: string | null;
  title: string;
  sessionType: LiveSessionType;
  file: File;
  uploadMode: LiveSessionUploadMode;
  language: 'en' | 'he';
  knownDurationSeconds?: number;
  onAssignmentCreated?: (assignmentId: string) => void;
};

type LiveSessionProcessingContextValue = {
  activeJob: LiveSessionActiveJob | null;
  isRunning: boolean;
  startJob: (
    input: StartJobInput
  ) => Promise<{ assignmentId: string; minimized: boolean } | { error: string }>;
  minimizeJob: () => void;
};

const LiveSessionProcessingContext = createContext<LiveSessionProcessingContextValue | null>(null);

function labelForProgress(
  progress: LiveSessionPipelineProgress,
  t: (key: string) => string
): string {
  switch (progress.phase) {
    case 'creating':
      return t('liveSession.create.creating');
    case 'converting':
      return t('liveSession.create.converting');
    case 'preparing':
      return t('liveSession.create.preparing');
    case 'uploading':
      return t('liveSession.create.uploading');
    case 'transcribing':
      return t('liveSession.create.transcribing');
    case 'summarizing':
      return t('liveSession.create.summarizing');
    case 'finishing':
      return t('liveSession.create.transcriptReady');
    default:
      return t('liveSession.create.creating');
  }
}

export function LiveSessionProcessingProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeJob, setActiveJob] = useState<LiveSessionActiveJob | null>(null);
  const minimizedRef = useRef(false);

  const clearJob = useCallback(() => {
    setActiveJob(null);
    minimizedRef.current = false;
  }, []);

  const minimizeJob = useCallback(() => {
    minimizedRef.current = true;
    setActiveJob((job) => (job ? { ...job, minimized: true } : null));
  }, []);

  const startJob = useCallback(
    async (
      input: StartJobInput
    ): Promise<{ assignmentId: string; minimized: boolean } | { error: string }> => {
      minimizedRef.current = false;
      setActiveJob({
        classroomId: input.classroomId,
        assignmentId: null,
        title: input.title.trim(),
        percent: 0,
        progressLabel: t('liveSession.create.creating'),
        transcriptionPhase: null,
        minimized: false,
      });

      const result = await runLiveSessionCreatePipeline({
        classroomId: input.classroomId,
        syllabusSectionId: input.syllabusSectionId,
        title: input.title,
        sessionType: input.sessionType,
        file: input.file,
        uploadMode: input.uploadMode,
        language: input.language,
        knownDurationSeconds: input.knownDurationSeconds,
        onAssignmentCreated: (assignmentId) => {
          setActiveJob((job) =>
            job ? { ...job, assignmentId } : job
          );
          input.onAssignmentCreated?.(assignmentId);
        },
        onProgress: (progress) => {
          setActiveJob((job) =>
            job
              ? {
                  ...job,
                  percent: progress.percent,
                  progressLabel: labelForProgress(progress, t),
                  transcriptionPhase: progress.transcriptionPhase ?? null,
                  chunkIndex: progress.chunkIndex,
                  chunkTotal: progress.chunkTotal,
                  minimized: minimizedRef.current,
                }
              : job
          );
        },
      });

      await queryClient.invalidateQueries({
        queryKey: assignmentKeys.classroomAssignmentLists(input.classroomId),
        exact: false,
      });

      if ('error' in result) {
        clearJob();
        const message = result.conversionError
          ? t('liveSession.create.conversionError')
          : t('liveSession.create.error');
        toast.error(message);
        return { error: result.error };
      }

      const assignmentId = result.assignmentId;
      const classroomId = input.classroomId;
      const wasMinimized = minimizedRef.current;

      clearJob();

      if (wasMinimized) {
        toast.success(t('liveSession.processing.completeTitle'), {
          duration: 10000,
          action: {
            label: t('liveSession.processing.view'),
            onClick: () => navigate(buildRoute.teacherLiveSession(classroomId, assignmentId)),
          },
          cancel: {
            label: t('liveSession.processing.later'),
            onClick: () => {},
          },
        });
      }

      return { assignmentId, minimized: wasMinimized };
    },
    [clearJob, navigate, queryClient, t]
  );

  const value = useMemo(
    (): LiveSessionProcessingContextValue => ({
      activeJob,
      isRunning: activeJob !== null,
      startJob,
      minimizeJob,
    }),
    [activeJob, startJob, minimizeJob]
  );

  return (
    <LiveSessionProcessingContext.Provider value={value}>
      {children}
      {activeJob?.minimized ? <LiveSessionProcessingBanner job={activeJob} /> : null}
    </LiveSessionProcessingContext.Provider>
  );
}

export function useLiveSessionProcessing(): LiveSessionProcessingContextValue {
  const ctx = useContext(LiveSessionProcessingContext);
  if (!ctx) {
    throw new Error('useLiveSessionProcessing must be used within LiveSessionProcessingProvider');
  }
  return ctx;
}
