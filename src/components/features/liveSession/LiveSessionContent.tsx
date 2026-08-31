import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { LiveSessionAudioPlaybackHandle } from '@/components/features/liveSession/LiveSessionAudioPlayback';
import type { LiveSession } from '@/types/liveSession';
import { LiveSessionEvaluationSection } from '@/components/features/liveSession/LiveSessionEvaluationSection';
import { LiveSessionReadyPanel } from '@/components/features/liveSession/LiveSessionReadyPanel';
import {
  isLiveSessionProcessing,
  LiveSessionStatusBanner,
} from '@/components/features/liveSession/LiveSessionStatusBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEnrolledStudents } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import {
  ensureStudentEvaluationSubmission,
  getLiveSessionByAssignment,
  getLiveSessionEvaluationStates,
  startLiveSessionTranscription,
  type StudentEvaluationState,
} from '@/services/liveSessionService';

export type LiveSessionContentProps = {
  classroomId: string;
  assignmentId: string;
};

export const LiveSessionContent = ({ classroomId, assignmentId }: LiveSessionContentProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [evalStates, setEvalStates] = useState<Record<string, StudentEvaluationState>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [preparingEval, setPreparingEval] = useState(false);

  const audioPlaybackRef = useRef<LiveSessionAudioPlaybackHandle | null>(null);
  const selectRequestRef = useRef(0);
  const { data: students = [] } = useEnrolledStudents(classroomId);

  const refreshSession = useCallback(async () => {
    const { data } = await getLiveSessionByAssignment(assignmentId);
    if (data) setSession(data);
    return data;
  }, [assignmentId]);

  const refreshEvalStates = useCallback(async () => {
    const { data } = await getLiveSessionEvaluationStates(assignmentId);
    setEvalStates(data);
  }, [assignmentId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await refreshSession();
      await refreshEvalStates();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refreshSession, refreshEvalStates]);

  useEffect(() => {
    if (!session || !isLiveSessionProcessing(session.status)) return;
    const interval = setInterval(() => {
      void refreshSession();
    }, 5000);
    return () => clearInterval(interval);
  }, [session, refreshSession]);

  const audioStoragePaths = useMemo(() => {
    if (!session) return [];
    if (session.audio_path?.includes('playback.m4a')) {
      return [session.audio_path];
    }
    if (session.audio_chunk_paths.length > 0) {
      return session.audio_chunk_paths;
    }
    return session.audio_path ? [session.audio_path] : [];
  }, [session]);

  const sessionContext = useMemo(() => {
    if (!session) return '';
    const parts: string[] = [];
    if (session.summary) parts.push(`Summary:\n${session.summary}`);
    if (session.transcript) parts.push(`Transcript:\n${session.transcript}`);
    return parts.join('\n\n');
  }, [session]);

  const studentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const enrollment of students) {
      map[enrollment.student_id] = enrollment.student_profiles?.full_name ?? t('common.student');
    }
    return map;
  }, [students, t]);

  const handleSeek = (seconds: number) => {
    audioPlaybackRef.current?.seek(seconds);
  };

  const handleSelectStudent = async (studentId: string) => {
    if (studentId === selectedStudentId && activeSubmissionId) return;

    const requestId = ++selectRequestRef.current;
    setSelectedStudentId(studentId);
    setActiveSubmissionId(null);
    setPreparingEval(true);
    try {
      const result = await ensureStudentEvaluationSubmission(assignmentId, studentId);
      if (requestId !== selectRequestRef.current) return;
      if ('error' in result) {
        toast.error(result.error.message);
        setSelectedStudentId(null);
        setActiveSubmissionId(null);
        return;
      }
      setActiveSubmissionId(result.submissionId);
    } finally {
      if (requestId === selectRequestRef.current) {
        setPreparingEval(false);
      }
    }
  };

  const handleEvaluationComplete = async () => {
    toast.success(t('liveSession.evaluation.saved'));
    await refreshEvalStates();
    setSelectedStudentId(null);
    setActiveSubmissionId(null);
  };

  const hasUploadedAudio =
    session != null &&
    (Boolean(session.audio_path) ||
      (Array.isArray(session.audio_chunk_paths) && session.audio_chunk_paths.length > 0));

  const handleRetryProcessing = async () => {
    if (!session) return;
    if (!hasUploadedAudio) {
      toast.error(t('liveSession.status.retryNoAudio'));
      return;
    }
    const chunkCount = Math.max(
      1,
      session.audio_chunk_paths?.length ?? (session.audio_path ? 1 : 0)
    );
    const { error } = await startLiveSessionTranscription(
      session.id,
      language === 'he' ? 'he' : 'en',
      chunkCount
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('liveSession.status.retried'));
    await refreshSession();
  };

  const isProcessing = session ? isLiveSessionProcessing(session.status) : false;
  const isReady = session?.status === 'ready';
  const isFailed = session?.status === 'failed';

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate(`/teacher/classroom/${classroomId}`, {
                state: { activeSection: 'outline' },
              })
            }
            className="gap-2"
          >
            <ArrowLeft className={cn('h-4 w-4', isRTL && 'rotate-180')} />
            {t('common.back')}
          </Button>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !session ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {t('liveSession.notFound')}
            </CardContent>
          </Card>
        ) : (
          <>
            <LiveSessionStatusBanner
              session={session}
              isProcessing={isProcessing}
              isFailed={isFailed}
              hasUploadedAudio={hasUploadedAudio}
              onRetry={handleRetryProcessing}
            />

            {isReady ? (
              <LiveSessionReadyPanel
                ref={audioPlaybackRef}
                session={session}
                audioStoragePaths={audioStoragePaths}
                isRTL={isRTL}
                onSeek={handleSeek}
              />
            ) : null}

            <LiveSessionEvaluationSection
              assignmentId={assignmentId}
              isRTL={isRTL}
              students={students}
              studentNameById={studentNameById}
              evalStates={evalStates}
              selectedStudentId={selectedStudentId}
              activeSubmissionId={activeSubmissionId}
              preparingEval={preparingEval}
              sessionContext={sessionContext || undefined}
              onSelectStudent={handleSelectStudent}
              onEvaluationComplete={handleEvaluationComplete}
            />
          </>
        )}
      </div>
    </div>
  );
};
