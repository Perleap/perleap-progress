import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { ClassroomLayout } from '@/components/layouts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { generateFeedback, completeSubmission, startNewSubmissionAttempt } from '@/services/submissionService';
import { ensureStudentFacingTask } from '@/services/assignmentService';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignmentFlowCompleteKeys,
  assignmentKeys,
  assignmentSubmittedFlagsKeys,
  useClassroom,
  useStudentAssignmentDetails,
  useSyllabus,
  useModuleFlowSteps,
} from '@/hooks/queries';
import { getStudentClassroomNavSections } from '@/lib/classroomNavSections';
import {
  getFirstNavigableInSection,
  getNextInSectionAfterAssignment,
  getNextSectionId,
  type FlowStepTarget,
} from '@/lib/moduleFlowNavigation';
import type { AssignmentRow } from '@/lib/moduleFlow';
import { ArrowLeft, Calendar, Loader2, Clock, RefreshCw, Lock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { AssignmentChatInterface } from '@/components/AssignmentChatInterface';
import { TestTakingPage } from '@/components/features/assignment/TestTakingPage';
import { ProjectSubmissionPage } from '@/components/features/assignment/ProjectSubmissionPage';
import { PresentationSubmissionPage } from '@/components/features/assignment/PresentationSubmissionPage';
import { LangchainBuilderPage } from '@/components/features/assignment/LangchainBuilderPage';
import { EssaySubmissionPage } from '@/components/features/assignment/EssaySubmissionPage';
import { useNuanceTracking } from '@/hooks/useNuanceTracking';
import { useStudentSectionModuleFlow } from '@/hooks/useStudentSectionModuleFlow';
import { canAccessComputedStep, canAccessPersistedStep } from '@/lib/moduleFlowStudent';
import { canGoBackInHistory, navigateBackOrTo } from '@/hooks/useNavigateBack';
import type { AssignmentLinkState } from '@/types/navigation';
import type { AssignmentCompletionTone } from '@/types/submission';
import { cn } from '@/lib/utils';

const AssignmentDetail = () => {
  const { t } = useTranslation();
  const { language: uiLanguage = 'en', isRTL } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const linkState = (location.state as AssignmentLinkState | null) ?? null;
  const queryClient = useQueryClient();
  const [retryLoading, setRetryLoading] = useState(false);

  const { data: assignmentData, isLoading: loading, refetch } = useStudentAssignmentDetails(id);
  const needsAutoStudentTask = Boolean(
    !loading && id && user && assignmentData && !String(assignmentData.student_facing_task ?? '').trim(),
  );
  const { isPending: isAutoFillingTaskCard } = useQuery({
    queryKey: ['autoStudentFacingTask', id, user?.id, uiLanguage],
    enabled: needsAutoStudentTask,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (!id || !user) return null;
      const lang: 'en' | 'he' = uiLanguage === 'he' ? 'he' : 'en';
      const { data } = await ensureStudentFacingTask(id, lang);
      const text = data?.studentFacingTask?.trim() ?? '';
      if (text) {
        await queryClient.invalidateQueries({ queryKey: [...assignmentKeys.detail(id), 'student', user.id] });
      }
      return data;
    },
  });
  const classroomId = assignmentData?.classroom_id;
  const { data: classroomForNav } = useClassroom(classroomId);
  const { data: syllabusForNav } = useSyllabus(classroomId);

  const studentNavSections = useMemo(
    () => getStudentClassroomNavSections(t, syllabusForNav?.status === 'published'),
    [syllabusForNav?.status, t],
  );

  const allowedNavIds = useMemo(() => new Set(studentNavSections.map((s) => s.id)), [studentNavSections]);

  const activeClassroomNavSection = useMemo(() => {
    const preferred = 'curriculum';
    if (allowedNavIds.has(preferred)) return preferred;
    return 'overview';
  }, [allowedNavIds]);

  const handleClassroomNav = useCallback(
    (section: string) => {
      if (!classroomId) return;
      navigate(`/student/classroom/${classroomId}`, { state: { activeSection: section } });
    },
    [classroomId, navigate],
  );

  const sectionFlow = useStudentSectionModuleFlow(
    assignmentData?.classroom_id,
    assignmentData?.syllabus_section_id ?? undefined,
    user?.id,
  );

  const nextSectionIdForNav = useMemo(
    () => getNextSectionId(syllabusForNav?.sections, assignmentData?.syllabus_section_id),
    [syllabusForNav?.sections, assignmentData?.syllabus_section_id],
  );

  const { data: nextSectionFlowSteps = [] } = useModuleFlowSteps(nextSectionIdForNav);

  const assignmentFlowContinue = useMemo(() => {
    if (!assignmentData?.syllabus_section_id || !assignmentData.id) return null;
    const nextIn = getNextInSectionAfterAssignment({
      usePersistedFlow: sectionFlow.usePersistedFlow,
      orderedPersisted: sectionFlow.orderedPersisted,
      computed: sectionFlow.computed,
      assignmentId: assignmentData.id,
    });
    const nextModId = getNextSectionId(syllabusForNav?.sections, assignmentData.syllabus_section_id);
    const firstNext =
      nextModId && syllabusForNav
        ? getFirstNavigableInSection({
            sectionId: nextModId,
            sectionResources: syllabusForNav.section_resources?.[nextModId] ?? [],
            assignments: sectionFlow.assignments as AssignmentRow[],
            persistedSteps: nextSectionFlowSteps,
          })
        : null;
    return { nextIn, firstNext, nextModId };
  }, [
    assignmentData?.id,
    assignmentData?.syllabus_section_id,
    sectionFlow.usePersistedFlow,
    sectionFlow.orderedPersisted,
    sectionFlow.computed,
    sectionFlow.assignments,
    syllabusForNav,
    nextSectionFlowSteps,
  ]);

  const navigateToFlowTarget = useCallback(
    (target: FlowStepTarget) => {
      if (!classroomId) return;
      if (target.kind === 'resource') {
        navigate(`/student/classroom/${classroomId}/activity/${target.id}`, {
          state: { returnClassroomSection: 'curriculum' },
        });
      } else {
        navigate(`/student/assignment/${target.id}`, {
          state: { returnClassroomSection: 'curriculum' } satisfies AssignmentLinkState,
        });
      }
    },
    [classroomId, navigate],
  );

  const handleBackFromAssignment = useCallback(() => {
    if (linkState?.fromStudentDashboard) {
      navigate('/student/dashboard');
      return;
    }
    /** Prefer explicit classroom + tab: history back often lacks activeSection and About is shown. */
    if (classroomId) {
      navigate(`/student/classroom/${classroomId}`, {
        state: { activeSection: linkState?.returnClassroomSection ?? 'curriculum' },
        replace: true,
      });
      return;
    }
    if (canGoBackInHistory()) {
      navigate(-1);
      return;
    }
    navigateBackOrTo(navigate, '/student/dashboard');
  }, [classroomId, linkState, navigate]);

  const goCurriculum = useCallback(() => {
    if (!classroomId) return;
    navigate(`/student/classroom/${classroomId}`, { state: { activeSection: 'curriculum' } });
  }, [classroomId, navigate]);

  const flowGuardLoading = !!assignmentData?.syllabus_section_id && sectionFlow.loading;

  const assignmentSequentialBlocked = useMemo(() => {
    if (!assignmentData?.syllabus_section_id) return false;
    const aid = assignmentData.id;
    if (sectionFlow.usePersistedFlow) {
      const idx = sectionFlow.orderedPersisted.findIndex(
        (s) => s.step_kind === 'assignment' && s.assignment_id === aid,
      );
      if (idx < 0) return false;
      return !canAccessPersistedStep(sectionFlow.orderedPersisted, idx, sectionFlow.ctx);
    }
    if (sectionFlow.computed.length > 0) {
      const idx = sectionFlow.computed.findIndex(
        (c) => c.kind === 'assignment' && c.assignment_id === aid,
      );
      if (idx < 0) return false;
      return !canAccessComputedStep(sectionFlow.computed, idx, sectionFlow.ctx);
    }
    return false;
  }, [assignmentData, sectionFlow]);

  const assignment = assignmentData;
  const submission = assignmentData?.submission;
  const feedback = assignmentData?.feedback;
  const submissionContext = assignmentData?.submissionContext as
    | { allAttempts: unknown[]; canRetry: boolean }
    | undefined;
  const canRetry = submissionContext?.canRetry ?? false;
  const attemptMode = (assignment as { attempt_mode?: string } | undefined)?.attempt_mode ?? 'single';

  const nuanceTracking = useNuanceTracking({
    studentId: user?.id,
    assignmentId: id,
    submissionId: submission?.id,
    enabled: !!assignment && !!submission && !feedback,
  });

  const handleAssignmentCompleted = useCallback(
    async (_tone?: AssignmentCompletionTone) => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      queryClient.invalidateQueries({ queryKey: assignmentFlowCompleteKeys.all });
      queryClient.invalidateQueries({ queryKey: assignmentSubmittedFlagsKeys.all });
      await refetch();
    },
    [queryClient, refetch],
  );

  const handleStartNewAttempt = async () => {
    if (!user?.id || !assignment?.id) return;
    setRetryLoading(true);
    try {
      const { error } = await startNewSubmissionAttempt(assignment.id, user.id);
      if (error) {
        toast.error(error.message || t('common.error'));
        return;
      }
      toast.success(t('assignmentDetail.newAttemptStarted'));
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      await refetch();
    } finally {
      setRetryLoading(false);
    }
  };

  const handleActivityComplete = async (args?: { conversationComplete?: boolean }) => {
    try {
      if (assignment && submission && user) {
        const autoPublish = assignment.auto_publish_ai_feedback !== false;
        const flowFlag =
          args?.conversationComplete !== undefined
            ? { conversationCompleteAtSubmit: args.conversationComplete }
            : {};

        if (!autoPublish) {
          const { error: completeError } = await completeSubmission(submission.id, {
            awaitingTeacherFeedbackRelease: true,
            ...flowFlag,
          });
          if (completeError) {
            console.error('Error completing submission:', completeError);
            toast.error(t('common.error'));
          } else {
            await handleAssignmentCompleted('awaitingTeacher');
          }
          return;
        }

        const language = getAssignmentLanguage(assignment.instructions, uiLanguage);
        const { error: feedbackError } = await generateFeedback({
          submissionId: submission.id,
          studentId: user.id,
          assignmentId: assignment.id,
          language,
        });

        if (feedbackError) {
          console.error('Error generating feedback:', feedbackError);
          toast.error(t('assignmentDetail.errors.generatingFeedback'));
        } else {
          const { error: completeError } = await completeSubmission(submission.id, flowFlag);

          if (completeError) {
            console.error('Error completing submission:', completeError);
            toast.error(t('common.error'));
          } else {
            await handleAssignmentCompleted('activityCompleted');
          }
        }
      }
    } catch (error) {
      console.error('Exception generating feedback:', error);
    }
  };

  if ((loading && !assignmentData) || (assignmentData && flowGuardLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assignmentData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Assignment not found or failed to load.</div>
      </div>
    );
  }

  if (assignmentSequentialBlocked) {
    return (
      <ClassroomLayout
        classroomName={classroomForNav?.name ?? assignment.classrooms?.name}
        classroomSubject={classroomForNav?.subject}
        activeSection={activeClassroomNavSection}
        onSectionChange={handleClassroomNav}
        customSections={studentNavSections}
        hideGlobalNav
      >
        <div
          className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <Lock className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden />
          <h1 className="text-xl font-semibold">{t('activityPage.sequentialBlockedTitle')}</h1>
          <p className="text-muted-foreground">{t('activityPage.sequentialBlockedBody')}</p>
          <Button
            type="button"
            onClick={() =>
              navigate(`/student/classroom/${assignment.classroom_id}`, {
                state: { activeSection: 'curriculum' },
              })
            }
          >
            {t('activityPage.backToActivities')}
          </Button>
        </div>
      </ClassroomLayout>
    );
  }

  return (
    <ClassroomLayout
      classroomName={classroomForNav?.name ?? assignment.classrooms?.name}
      classroomSubject={classroomForNav?.subject}
      activeSection={activeClassroomNavSection}
      onSectionChange={handleClassroomNav}
      customSections={studentNavSections}
      hideGlobalNav
    >
      <div className="container py-4 px-0 max-w-4xl">
        <div className="space-y-6">
          <div className={cn('flex shrink-0 items-center gap-3', isRTL && 'flex-row-reverse')}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={handleBackFromAssignment}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('common.back')}
            </Button>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>
                    {assignment.title?.trim() || t('assignmentDetail.untitledAssignment')}
                  </CardTitle>
                  <CardDescription className="flex flex-col gap-1 mt-2">
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0" />
                      {assignment.due_at &&
                        `${t('assignmentDetail.dueDate')}: ${new Date(assignment.due_at).toLocaleString()}`}
                    </span>
                    {attemptMode === 'single' && (
                      <span className="text-xs text-muted-foreground">{t('assignmentDetail.attemptBannerSingle')}</span>
                    )}
                    {attemptMode === 'multiple_until_due' && (
                      <span className="text-xs text-muted-foreground">
                        {assignment.due_at
                          ? t('assignmentDetail.attemptBannerUntil', {
                              date: new Date(assignment.due_at).toLocaleString(),
                            })
                          : t('assignmentDetail.attemptBannerSingle')}
                      </span>
                    )}
                    {attemptMode === 'multiple_unlimited' && (
                      <span className="text-xs text-muted-foreground">{t('assignmentDetail.attemptBannerUnlimited')}</span>
                    )}
                  </CardDescription>
                </div>
                <Badge variant="secondary">{t(`assignmentTypes.${assignment.type}`)}</Badge>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-muted/20">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium">{t('assignmentDetail.studentTaskTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm">
              {assignment.student_facing_task?.trim() ? (
                <p className="whitespace-pre-wrap text-foreground leading-relaxed" dir="auto">
                  {assignment.student_facing_task.trim()}
                </p>
              ) : isAutoFillingTaskCard ? (
                <p className="flex items-center gap-2 text-muted-foreground" dir="auto">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  {t('assignmentDetail.loadingStudentTask')}
                </p>
              ) : (
                <p className="text-muted-foreground leading-relaxed" dir="auto">
                  {t('assignmentDetail.studentTaskNotSetYet')}
                </p>
              )}
            </CardContent>
          </Card>

          {!feedback && submission && (() => {
            const MANUAL_EVAL_TYPES = ['project', 'presentation', 'langchain'];
            const isManualEvalType = MANUAL_EVAL_TYPES.includes(assignment.type);
            const isCompleted = submission.status === 'completed';

            const flowContinueRow =
              assignmentFlowContinue &&
              assignment.syllabus_section_id &&
              submission.status === 'completed' ? (
                <div
                  className="flex flex-wrap justify-center gap-2 pt-4"
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  {assignmentFlowContinue.nextIn ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1 bg-background"
                      onClick={() => navigateToFlowTarget(assignmentFlowContinue.nextIn!)}
                    >
                      {assignmentFlowContinue.nextIn.kind === 'assignment'
                        ? t('assignmentDetail.continue')
                        : t('activityPage.continueNext')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {!assignmentFlowContinue.nextIn && assignmentFlowContinue.firstNext ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1 bg-background"
                      onClick={() => navigateToFlowTarget(assignmentFlowContinue.firstNext!)}
                    >
                      {t('assignmentDetail.continueNextModule')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {!assignmentFlowContinue.nextIn && !assignmentFlowContinue.firstNext ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1 bg-background"
                      onClick={goCurriculum}
                    >
                      {t('assignmentDetail.openCurriculum')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ) : null;

            if (isCompleted && submission.awaiting_teacher_feedback_release) {
              return (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="h-10 w-10 text-primary mb-4" />
                    <p className="text-sm font-medium text-primary">
                      {t('assignmentDetail.awaitingTeacherFeedback')}
                    </p>
                    {flowContinueRow}
                  </CardContent>
                </Card>
              );
            }

            if (isManualEvalType && isCompleted) {
              const awaitingKey = `assignmentDetail.${assignment.type}.awaitingReview`;
              return (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="h-10 w-10 text-primary mb-4" />
                    <p className="text-sm font-medium text-primary">
                      {t(awaitingKey)}
                    </p>
                    {flowContinueRow}
                  </CardContent>
                </Card>
              );
            }

            const companionChat = (
              <AssignmentChatInterface
                assignmentId={assignment.id}
                assignmentTitle={assignment.title}
                teacherName={assignment.classrooms.teacher_profiles?.full_name || 'Teacher'}
                assignmentInstructions={assignment.instructions}
                submissionId={submission.id}
                onComplete={() => {}}
                nuanceTracking={nuanceTracking}
                variant="companion"
              />
            );

            switch (assignment.type) {
              case 'test':
                return (
                  <div className="space-y-6">
                    {companionChat}
                    <TestTakingPage
                      assignmentId={assignment.id}
                      assignmentInstructions={assignment.instructions}
                      submissionId={submission.id}
                      autoPublishAiFeedback={assignment.auto_publish_ai_feedback !== false}
                      onComplete={handleAssignmentCompleted}
                    />
                  </div>
                );
              case 'text_essay':
                return (
                  <div className="space-y-6">
                    {companionChat}
                    <EssaySubmissionPage
                      assignmentId={assignment.id}
                      submissionId={submission.id}
                      assignmentInstructions={assignment.instructions}
                      autoPublishAiFeedback={assignment.auto_publish_ai_feedback !== false}
                      initialText={submission.text_body}
                      onComplete={handleAssignmentCompleted}
                    />
                  </div>
                );
              case 'project':
                return (
                  <div className="space-y-6">
                    {companionChat}
                    <ProjectSubmissionPage
                      assignmentId={assignment.id}
                      submissionId={submission.id}
                      onComplete={handleAssignmentCompleted}
                    />
                  </div>
                );
              case 'presentation':
                return (
                  <div className="space-y-6">
                    {companionChat}
                    <PresentationSubmissionPage
                      assignmentId={assignment.id}
                      submissionId={submission.id}
                      onComplete={handleAssignmentCompleted}
                    />
                  </div>
                );
              case 'langchain':
                return (
                  <div className="space-y-6">
                    {companionChat}
                    <LangchainBuilderPage
                      assignmentId={assignment.id}
                      submissionId={submission.id}
                      initialPipelineText={submission.text_body}
                      onComplete={handleAssignmentCompleted}
                    />
                  </div>
                );
              default:
                return (
                  <AssignmentChatInterface
                    assignmentId={assignment.id}
                    assignmentTitle={assignment.title}
                    teacherName={assignment.classrooms.teacher_profiles?.full_name || 'Teacher'}
                    assignmentInstructions={assignment.instructions}
                    submissionId={submission.id}
                    onComplete={handleActivityComplete}
                    nuanceTracking={nuanceTracking}
                    variant="primary"
                  />
                );
            }
          })()}

          {feedback && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-primary">{t('assignmentDetail.viewFeedback')}</CardTitle>
                <CardDescription>
                  {t('assignmentDetail.submitted')}:{' '}
                  {new Date(feedback.created_at).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {feedback.student_feedback?.replace(/\*\*/g, '')?.replace(/\/\//g, '')?.trim()}
                </div>
              </CardContent>
            </Card>
          )}

          {submission?.status === 'completed' &&
          feedback &&
          (canRetry || (assignmentFlowContinue && assignment.syllabus_section_id)) ? (
            <div
              className="flex w-full flex-wrap items-center justify-center gap-2 not-prose pt-2"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {canRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 bg-background"
                  onClick={() => void handleStartNewAttempt()}
                  disabled={retryLoading}
                >
                  {retryLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {t('assignmentDetail.startNewAttempt')}
                </Button>
              ) : null}
              {assignmentFlowContinue && assignment.syllabus_section_id ? (
                <>
                  {assignmentFlowContinue.nextIn ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1 bg-background"
                      onClick={() => navigateToFlowTarget(assignmentFlowContinue.nextIn!)}
                    >
                      {assignmentFlowContinue.nextIn.kind === 'assignment'
                        ? t('assignmentDetail.continue')
                        : t('activityPage.continueNext')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {!assignmentFlowContinue.nextIn && assignmentFlowContinue.firstNext ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1 bg-background"
                      onClick={() => navigateToFlowTarget(assignmentFlowContinue.firstNext!)}
                    >
                      {t('assignmentDetail.continueNextModule')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {!assignmentFlowContinue.nextIn && !assignmentFlowContinue.firstNext ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1 bg-background"
                      onClick={goCurriculum}
                    >
                      {t('assignmentDetail.openCurriculum')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : canRetry && submission?.status === 'completed' ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2 bg-background"
                onClick={() => void handleStartNewAttempt()}
                disabled={retryLoading}
              >
                {retryLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {t('assignmentDetail.startNewAttempt')}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </ClassroomLayout>
  );
};

export default AssignmentDetail;
