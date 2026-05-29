import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEnrolledStudents } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { TeacherEvaluationForm } from '@/components/features/submission/TeacherEvaluationForm';
import {
  ensureStudentEvaluationSubmission,
  getLiveSessionAudioUrl,
  getLiveSessionByAssignment,
  getLiveSessionEvaluationStates,
  startLiveSessionTranscription,
  type StudentEvaluationState,
} from '@/services/liveSessionService';
import type { LiveSession } from '@/types/liveSession';

const PROCESSING_STATUSES = new Set(['extracted', 'transcribing']);

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export default function LiveSessionPage() {
  const { id: classroomId, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL, language } = useLanguage();

  const [session, setSession] = useState<LiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [evalStates, setEvalStates] = useState<Record<string, StudentEvaluationState>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
  const [preparingEval, setPreparingEval] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectRequestRef = useRef(0);
  const { data: students = [] } = useEnrolledStudents(classroomId);

  const refreshSession = useCallback(async () => {
    if (!assignmentId) return null;
    const { data } = await getLiveSessionByAssignment(assignmentId);
    if (data) setSession(data);
    return data;
  }, [assignmentId]);

  const refreshEvalStates = useCallback(async () => {
    if (!assignmentId) return;
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

  // Poll while the session is still processing.
  useEffect(() => {
    if (!session || !PROCESSING_STATUSES.has(session.status)) return;
    const interval = setInterval(() => {
      void refreshSession();
    }, 5000);
    return () => clearInterval(interval);
  }, [session, refreshSession]);

  // Fetch a signed audio URL once ready.
  useEffect(() => {
    if (session?.status === 'ready' && session.audio_path && !audioUrl) {
      void getLiveSessionAudioUrl(session.audio_path).then((url) => setAudioUrl(url));
    }
  }, [session, audioUrl]);

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
      map[enrollment.student_id] =
        enrollment.student_profiles?.full_name ?? t('common.student');
    }
    return map;
  }, [students, t]);

  const handleSeek = (seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = seconds;
    void el.play().catch(() => {});
  };

  const handleSelectStudent = async (studentId: string) => {
    if (!assignmentId) return;
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
    const { error } = await startLiveSessionTranscription(session.id, language === 'he' ? 'he' : 'en');
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t('liveSession.status.retried'));
    await refreshSession();
  };

  const isProcessing = session ? PROCESSING_STATUSES.has(session.status) : false;
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
            {/* Processing / status banner */}
            {isProcessing ? (
              <Card>
                <CardContent className="flex items-center gap-3 py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">{t('liveSession.status.processing')}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(`liveSession.status.${session.status}`)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {isFailed ? (
              <Card className="border-destructive/40">
                <CardContent className="flex items-center justify-between gap-3 py-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-medium">{t('liveSession.status.failed')}</p>
                      {session.error ? (
                        <p className="text-sm text-muted-foreground">{session.error}</p>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasUploadedAudio}
                    onClick={() => void handleRetryProcessing()}
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t('liveSession.status.retry')}
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {/* Audio + summary + timestamps */}
            {isReady ? (
              <div className="space-y-6">
                {audioUrl ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('liveSession.audio.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio ref={audioRef} src={audioUrl} controls className="w-full" />
                    </CardContent>
                  </Card>
                ) : null}

                {session.summary ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('liveSession.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {session.summary}
                      </p>
                    </CardContent>
                  </Card>
                ) : null}

                {session.timestamps.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('liveSession.timestamps.title')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {session.timestamps.map((ts, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSeek(ts.time)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted',
                            isRTL && 'flex-row-reverse text-end',
                          )}
                        >
                          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs text-primary">
                            <Clock className="h-3 w-3" />
                            {formatTime(ts.time)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-foreground">{ts.label}</span>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                {session.transcript ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t('liveSession.transcript.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {session.transcript}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {/* Per-student evaluation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('liveSession.evaluation.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t('liveSession.evaluation.hint')}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    value={selectedStudentId ?? undefined}
                    onValueChange={(studentId) => void handleSelectStudent(studentId)}
                  >
                    <SelectTrigger
                      className={cn(
                        'h-auto w-full rounded-lg border p-3 shadow-none',
                        'focus-visible:ring-2 focus-visible:ring-primary/25',
                        isRTL && 'flex-row-reverse text-end',
                      )}
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <span
                        className={cn(
                          'flex min-w-0 flex-1 items-center justify-between gap-2',
                          isRTL && 'flex-row-reverse',
                        )}
                      >
                        <SelectValue placeholder={t('liveSession.evaluation.selectStudent')}>
                          {selectedStudentId ? studentNameById[selectedStudentId] : null}
                        </SelectValue>
                        {selectedStudentId && evalStates[selectedStudentId]?.evaluated ? (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-green-600"
                            aria-label={t('liveSession.evaluation.evaluated')}
                          />
                        ) : selectedStudentId ? (
                          <span className="h-4 w-4 shrink-0" aria-hidden />
                        ) : null}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      className="rounded-lg border-border bg-card p-1"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      {students.map((enrollment) => {
                        const studentId = enrollment.student_id;
                        const name = studentNameById[studentId] ?? t('common.student');
                        return (
                          <SelectItem
                            key={studentId}
                            value={studentId}
                            className="cursor-pointer rounded-lg"
                          >
                            {name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedStudentId ? (
                  preparingEval ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('liveSession.evaluation.preparing')}
                    </div>
                  ) : activeSubmissionId && assignmentId ? (
                    <TeacherEvaluationForm
                      key={selectedStudentId}
                      submissionId={activeSubmissionId}
                      studentId={selectedStudentId}
                      assignmentId={assignmentId}
                      sessionContext={sessionContext || undefined}
                      onEvaluationComplete={() => void handleEvaluationComplete()}
                    />
                  ) : null
                ) : null}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
