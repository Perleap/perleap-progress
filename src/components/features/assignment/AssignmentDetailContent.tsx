import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Lock, ChevronRight } from 'lucide-react';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type { DbAssignmentType } from '@/types/models';
import type { AssignmentLinkState } from '@/types/navigation';
import { useStudentSectionModuleFlow } from '@/hooks/useStudentSectionModuleFlow';
import { canAccessComputedStep, canAccessPersistedStep } from '@/lib/moduleFlowStudent';
import type { AssignmentCompletionTone } from '@/types/submission';
import { invalidateStudentTimelineCurriculaQueries } from '@/lib/studentTimelineCurriculaKeys';
import { canStartFirstAttempt } from '@/lib/assignmentAttemptPolicy';
import {
  AssignmentDetailBackBar,
  AssignmentDetailLayout,
  useAssignmentDetailNav,
} from '@/components/features/assignment/AssignmentDetailLayout';
import {
  AssignmentDetailIntroBlock,
  useAssignmentDetailIntro,
} from '@/components/features/assignment/AssignmentDetailIntroBlock';
import { AssignmentDetailMaterialsPanel } from '@/components/features/assignment/AssignmentDetailMaterialsPanel';
import { AssignmentDetailSubmissionRouter } from '@/components/features/assignment/AssignmentDetailSubmissionRouter';
import { StudentFacingTaskSection } from '@/components/features/assignment/StudentFacingTaskSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import {
  assignmentFlowCompleteKeys,
  assignmentKeys,
  assignmentSubmittedFlagsKeys,
  useClassroom,
  useStudentAssignmentDetails,
  useSyllabus,
  useModuleFlowSteps,
} from '@/hooks/queries';
import { notificationKeys } from '@/hooks/queries/useNotificationQueries';
import { useAssignmentClipboardTracking } from '@/hooks/useAssignmentClipboardTracking';
import { useNuanceTracking } from '@/hooks/useNuanceTracking';
import {
  pickEligiblePriorSubmissionIds,
  readAssignmentContextCarryover,
  writeAssignmentContextCarryover,
} from '@/lib/assignmentContextCarryover';
import { studentModuleFlowStepOptions, type AssignmentRow } from '@/lib/moduleFlow';
import {
  getFirstNavigableInSection,
  getNextInSectionAfterAssignment,
  getNextSectionId,
  type FlowStepTarget,
} from '@/lib/moduleFlowNavigation';
import { getUnreadNotifications, markAsRead } from '@/lib/notificationService';
import { ensureStudentFacingTask } from '@/services/assignmentService';
import {
  completeSubmission,
  submitWithBackgroundAiFeedback,
  startNewSubmissionAttempt,
} from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';

export type AssignmentDetailContentProps = {
  assignmentId: string;
  isTeacherTry: boolean;
  teacherRouteClassroomId?: string;
};

export const AssignmentDetailContent = ({
  assignmentId,
  isTeacherTry,
  teacherRouteClassroomId,
}: AssignmentDetailContentProps) => {
  const { t } = useTranslation();
  const { language: uiLanguage = 'en', isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const linkState = (location.state as AssignmentLinkState | null) ?? null;
  const queryClient = useQueryClient();
  const [retryLoading, setRetryLoading] = useState(false);
  const companionChatAnchorRef = useRef<HTMLDivElement>(null);
  const assignmentClipboardRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isTeacherTry || !assignmentId || !user?.id) return;
    let cancelled = false;
    void (async () => {
      const list = await queryClient.fetchQuery({
        queryKey: notificationKeys.unread(user.id),
        queryFn: () => getUnreadNotifications(user.id),
        staleTime: 0,
      });
      const ids = list
        .filter(
          (n) => n.type === 'assignment_new_attempt' && n.metadata?.assignment_id === assignmentId
        )
        .map((n) => n.id);
      for (const id of ids) {
        await markAsRead(id);
      }
      if (!cancelled && ids.length > 0) {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTeacherTry, assignmentId, user?.id, queryClient]);

  const {
    data: assignmentData,
    isLoading: loading,
    refetch,
  } = useStudentAssignmentDetails(assignmentId || undefined, { isTeacherTry });

  const needsAutoStudentTask = Boolean(
    !isTeacherTry &&
    !loading &&
    assignmentId &&
    user &&
    assignmentData &&
    !String(assignmentData.student_facing_task ?? '').trim()
  );
  const {
    data: autoStudentTaskResult,
    isPending: isAutoFillingTaskCard,
    isFetching: isAutoFillingTaskFetching,
  } = useQuery({
    queryKey: ['autoStudentFacingTask', assignmentId, user?.id, uiLanguage],
    enabled: needsAutoStudentTask,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      if (!assignmentId || !user) return null;
      const lang: 'en' | 'he' = uiLanguage === 'he' ? 'he' : 'en';
      const { data } = await ensureStudentFacingTask(assignmentId, lang);
      const text = data?.studentFacingTask?.trim() ?? '';
      if (text) {
        await queryClient.invalidateQueries({
          queryKey: [...assignmentKeys.detail(assignmentId), 'student', user.id, isTeacherTry],
        });
      }
      return data;
    },
  });

  const resolvedStudentFacingTask = useMemo(() => {
    const fromDb = String(assignmentData?.student_facing_task ?? '').trim();
    if (fromDb) return fromDb;
    return String(autoStudentTaskResult?.studentFacingTask ?? '').trim();
  }, [assignmentData?.student_facing_task, autoStudentTaskResult]);

  const isStudentTaskLoading = Boolean(
    needsAutoStudentTask &&
    !resolvedStudentFacingTask &&
    (isAutoFillingTaskCard || isAutoFillingTaskFetching)
  );
  const classroomId = assignmentData?.classroom_id;
  const { data: classroomForNav } = useClassroom(classroomId);
  const { data: syllabusForNav } = useSyllabus(classroomId);

  const {
    studentNavSections,
    teacherNavSections,
    activeClassroomNavSection,
    handleClassroomNav,
    handleTeacherClassroomNav,
    handleBackFromAssignment,
  } = useAssignmentDetailNav({
    isTeacherTry,
    teacherRouteClassroomId,
    classroomId,
    linkState,
    syllabusPublished: syllabusForNav?.status === 'published',
  });

  const sectionFlow = useStudentSectionModuleFlow(
    assignmentData?.classroom_id,
    assignmentData?.syllabus_section_id ?? undefined,
    user?.id
  );

  const nextSectionIdForNav = useMemo(
    () => getNextSectionId(syllabusForNav?.sections, assignmentData?.syllabus_section_id),
    [syllabusForNav?.sections, assignmentData?.syllabus_section_id]
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
    const nextModId = getNextSectionId(
      syllabusForNav?.sections,
      assignmentData.syllabus_section_id
    );
    const firstNext =
      nextModId && syllabusForNav
        ? getFirstNavigableInSection({
            sectionId: nextModId,
            sectionResources: syllabusForNav.section_resources?.[nextModId] ?? [],
            assignments: sectionFlow.assignments as AssignmentRow[],
            persistedSteps: nextSectionFlowSteps,
            flowStepOptions: studentModuleFlowStepOptions(
              sectionFlow.assignments as Array<{ id: string; type?: string | null }>
            ),
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
    (target: FlowStepTarget, opts?: { priorSubmissionId?: string }) => {
      if (!classroomId) return;
      if (isTeacherTry && teacherRouteClassroomId) {
        if (target.kind === 'resource') {
          navigate(`/teacher/classroom/${teacherRouteClassroomId}/activity/${target.id}`, {
            state: { returnClassroomSection: 'outline' },
          });
        } else {
          navigate(`/teacher/classroom/${teacherRouteClassroomId}/try/assignment/${target.id}`);
        }
        return;
      }
      if (target.kind === 'resource') {
        navigate(`/student/classroom/${classroomId}/activity/${target.id}`, {
          state: { returnClassroomSection: 'curriculum' },
        });
      } else {
        const priorSubmissionId =
          target.kind === 'assignment' ? opts?.priorSubmissionId : undefined;
        navigate(`/student/assignment/${target.id}`, {
          state: {
            returnClassroomSection: 'curriculum',
            ...(priorSubmissionId ? { priorSubmissionId } : {}),
          } satisfies AssignmentLinkState,
        });
      }
    },
    [classroomId, navigate, isTeacherTry, teacherRouteClassroomId]
  );

  const goCurriculum = useCallback(() => {
    if (!classroomId) return;
    if (isTeacherTry && teacherRouteClassroomId) {
      navigate(`/teacher/classroom/${teacherRouteClassroomId}`, {
        state: { activeSection: 'outline' },
      });
      return;
    }
    navigate(`/student/classroom/${classroomId}`, { state: { activeSection: 'curriculum' } });
  }, [classroomId, navigate, isTeacherTry, teacherRouteClassroomId]);

  const flowGuardLoading = !!assignmentData?.syllabus_section_id && sectionFlow.loading;

  const assignmentSequentialBlocked = useMemo(() => {
    if (!assignmentData?.syllabus_section_id) return false;
    const aid = assignmentData.id;
    const accessMeta = {
      assignments: sectionFlow.assignments as AssignmentRow[],
      now: new Date(),
    };
    if (sectionFlow.usePersistedFlow) {
      const idx = sectionFlow.orderedPersisted.findIndex(
        (s) => s.step_kind === 'assignment' && s.assignment_id === aid
      );
      if (idx < 0) return false;
      return !canAccessPersistedStep(
        sectionFlow.orderedPersisted,
        idx,
        sectionFlow.ctx,
        accessMeta
      );
    }
    if (sectionFlow.computed.length > 0) {
      const idx = sectionFlow.computed.findIndex(
        (c) => c.kind === 'assignment' && c.assignment_id === aid
      );
      if (idx < 0) return false;
      return !canAccessComputedStep(sectionFlow.computed, idx, sectionFlow.ctx, accessMeta);
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
  const attemptMode =
    (assignment as { attempt_mode?: string } | undefined)?.attempt_mode ?? 'single';

  const chatPriorSubmissionIds = useMemo(() => {
    if (isTeacherTry || !user?.id || !assignmentData?.id || !assignmentData.classroom_id) {
      return [];
    }
    const sid = assignmentData.submission?.id;
    const fromNav = linkState?.priorSubmissionId?.trim();
    const stored = readAssignmentContextCarryover();
    const fromSession = pickEligiblePriorSubmissionIds(
      stored,
      user.id,
      assignmentData.classroom_id,
      assignmentData.id
    );
    const inSession = new Set(fromSession);
    const ids = [...fromSession];
    if (fromNav && (!sid || fromNav !== sid) && !inSession.has(fromNav)) {
      ids.push(fromNav);
    }
    return ids;
  }, [
    isTeacherTry,
    user?.id,
    assignmentData?.id,
    assignmentData?.classroom_id,
    assignmentData?.submission?.id,
    linkState?.priorSubmissionId,
  ]);

  const syllabusSectionTitle = useMemo(() => {
    const sectionId = assignment?.syllabus_section_id;
    const sections = syllabusForNav?.sections;
    if (!sectionId || !sections?.length) return null;
    const section = sections.find((s) => s.id === sectionId);
    return section?.title?.trim() || null;
  }, [assignment?.syllabus_section_id, syllabusForNav?.sections]);

  const nuanceTracking = useNuanceTracking({
    studentId: user?.id,
    assignmentId: assignmentId || undefined,
    submissionId: submission?.id,
    enabled: !!assignment && !!submission && !feedback && !isTeacherTry,
  });

  const clipboardTracking = useAssignmentClipboardTracking({
    studentId: user?.id,
    assignmentId: assignmentId || undefined,
    submissionId: submission?.id,
    enabled: !!assignment && !!submission && !feedback && !isTeacherTry,
  });

  useEffect(() => {
    const root = assignmentClipboardRootRef.current;
    if (!root || !clipboardTracking) return;

    const onCopy = () => {
      clipboardTracking.handleWorkspaceCopy(root);
    };
    root.addEventListener('copy', onCopy);
    return () => root.removeEventListener('copy', onCopy);
  }, [clipboardTracking, submission?.id]);

  const {
    introWizardOpen,
    setIntroWizardOpen,
    shouldShowAssignmentTypeIntro,
    handleTypeStepComplete,
    handleTaskConfirm,
    chatInitAllowed,
    initialGreetingMode,
    storedTaskUnderstandingChoice,
    introClipboardTracking,
    studentFacingTaskForIntro,
  } = useAssignmentDetailIntro({
    isTeacherTry,
    userId: user?.id,
    assignment,
    submission,
    hasFeedback: Boolean(feedback),
    isStudentTaskLoading,
    resolvedStudentFacingTask,
    clipboardTracking,
    companionChatAnchorRef,
  });

  const handleAssignmentCompleted = useCallback(
    async (tone?: AssignmentCompletionTone) => {
      if (
        !isTeacherTry &&
        user?.id &&
        assignmentData?.id &&
        assignmentData.classroom_id &&
        assignmentData.submission?.id
      ) {
        writeAssignmentContextCarryover({
          priorSubmissionId: assignmentData.submission.id,
          priorAssignmentId: assignmentData.id,
          classroomId: assignmentData.classroom_id,
          studentId: user.id,
        });
      }
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      queryClient.invalidateQueries({ queryKey: assignmentFlowCompleteKeys.all });
      queryClient.invalidateQueries({ queryKey: assignmentSubmittedFlagsKeys.all });
      invalidateStudentTimelineCurriculaQueries(queryClient);
      await refetch();
      if (tone === 'activityCompleted') {
        toast.success(t('assignmentDetail.success.completed'));
      } else if (tone === 'awaitingTeacher') {
        toast.success(t('assignmentDetail.success.submittedAwaitingTeacher'));
      }
    },
    [
      queryClient,
      refetch,
      isTeacherTry,
      user?.id,
      assignmentData?.id,
      assignmentData?.classroom_id,
      assignmentData?.submission?.id,
      t,
    ]
  );

  const handleStartNewAttempt = async () => {
    if (!user?.id || !assignment?.id) return;
    setRetryLoading(true);
    try {
      const { error } = await startNewSubmissionAttempt(assignment.id, user.id, {
        isTeacherAttempt: isTeacherTry,
      });
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
        const flowFlag =
          args?.conversationComplete !== undefined
            ? { conversationCompleteAtSubmit: args.conversationComplete }
            : {};

        if (isTeacherTry) {
          const { error: completeError } = await completeSubmission(submission.id, flowFlag);
          if (completeError) {
            console.error('Error completing submission:', completeError);
            toast.error(t('common.error'));
          } else {
            toast.success(t('teacherTry.previewMarkedComplete'));
            await handleAssignmentCompleted('activityCompleted');
          }
          return;
        }

        const enableAiFeedback = assignment.enable_ai_feedback !== false;
        const showAiFeedbackToStudents = assignment.auto_publish_ai_feedback !== false;

        if (!enableAiFeedback) {
          const { error: completeError } = await completeSubmission(submission.id, flowFlag);
          if (completeError) {
            console.error('Error completing submission:', completeError);
            toast.error(t('common.error'));
          } else {
            await handleAssignmentCompleted('activityCompleted');
          }
          return;
        }

        const language = getAssignmentLanguage(assignment.instructions, uiLanguage);
        const { error: submitError, evaluationInvokeFailed } = await submitWithBackgroundAiFeedback(
          {
            submissionId: submission.id,
            studentId: user.id,
            assignmentId: assignment.id,
            language,
            completeOptions: flowFlag,
          }
        );

        if (submitError) {
          console.error('Error completing submission:', submitError);
          toast.error(t('common.error'));
        } else {
          if (evaluationInvokeFailed) {
            toast.warning(t('assignmentDetail.errors.generatingFeedbackButCompleted'));
          }
          await handleAssignmentCompleted(
            showAiFeedbackToStudents ? 'activityCompleted' : 'awaitingTeacher'
          );
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

  if (!assignmentData || !assignment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Assignment not found or failed to load.</div>
      </div>
    );
  }

  if (
    isTeacherTry &&
    teacherRouteClassroomId &&
    assignmentData.classroom_id !== teacherRouteClassroomId
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center text-muted-foreground">{t('teacherTry.classroomMismatch')}</div>
      </div>
    );
  }

  if (assignmentSequentialBlocked && !isTeacherTry) {
    return (
      <AssignmentDetailLayout
        isTeacherTry={false}
        classroomName={classroomForNav?.name ?? assignment.classrooms?.name}
        classroomSubject={classroomForNav?.subject}
        studentNavSections={studentNavSections}
        teacherNavSections={teacherNavSections}
        activeClassroomNavSection={activeClassroomNavSection}
        onClassroomNav={handleClassroomNav}
        onTeacherClassroomNav={handleTeacherClassroomNav}
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
      </AssignmentDetailLayout>
    );
  }

  return (
    <AssignmentDetailLayout
      isTeacherTry={isTeacherTry}
      classroomName={classroomForNav?.name ?? assignment.classrooms?.name}
      classroomSubject={classroomForNav?.subject}
      studentNavSections={studentNavSections}
      teacherNavSections={teacherNavSections}
      activeClassroomNavSection={activeClassroomNavSection}
      onClassroomNav={handleClassroomNav}
      onTeacherClassroomNav={handleTeacherClassroomNav}
    >
      <div className="container py-4 px-0 max-w-4xl">
        {assignment ? (
          <AssignmentDetailIntroBlock
            assignment={assignment}
            open={introWizardOpen}
            onOpenChange={setIntroWizardOpen}
            skipTypeStep={!shouldShowAssignmentTypeIntro}
            studentFacingTask={studentFacingTaskForIntro}
            taskLoading={isStudentTaskLoading}
            onTypeStepComplete={handleTypeStepComplete}
            onTaskConfirm={handleTaskConfirm}
            clipboardTracking={introClipboardTracking}
          />
        ) : null}
        <div className="space-y-6 pb-8">
          <AssignmentDetailBackBar
            isTeacherTry={isTeacherTry}
            isRTL={isRTL}
            onBack={handleBackFromAssignment}
          />
          <div className="space-y-2 text-start" dir={isRTL ? 'rtl' : 'ltr'}>
            {syllabusSectionTitle ? (
              <p className="text-sm font-medium text-muted-foreground">
                {t('assignmentDetail.unitSectionLabel', { title: syllabusSectionTitle })}
              </p>
            ) : null}
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {assignment.title?.trim() || t('assignmentDetail.untitledAssignment')}
            </h1>
            <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
              {assignment.due_at && (
                <span>
                  {`${t('assignmentDetail.dueDate')}: ${new Date(assignment.due_at).toLocaleString()}`}
                </span>
              )}
              {attemptMode === 'single' && (
                <span className="text-xs text-muted-foreground">
                  {t('assignmentDetail.attemptBannerSingle')}
                </span>
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
                <span className="text-xs text-muted-foreground">
                  {t('assignmentDetail.attemptBannerUnlimited')}
                </span>
              )}
            </div>
          </div>

          <div ref={assignmentClipboardRootRef} className="space-y-6">
            {assignment ? (
              <StudentFacingTaskSection
                assignmentType={assignment.type as DbAssignmentType}
                taskText={resolvedStudentFacingTask || assignment.student_facing_task}
                taskLoading={isStudentTaskLoading}
              />
            ) : null}

            <AssignmentDetailMaterialsPanel
              assignmentMaterialsRaw={assignmentData?.materials}
              syllabusSectionId={assignmentData?.syllabus_section_id}
              sectionResources={syllabusForNav?.section_resources}
              isRTL={isRTL}
            />

            {!feedback && !submission && (
              <Card className="border-dashed border-border/80 bg-muted/10">
                <CardContent
                  className="py-8 text-center text-sm text-muted-foreground space-y-1"
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <p>
                    {(() => {
                      const attemptsLen = submissionContext?.allAttempts?.length ?? 0;
                      const policy = {
                        attempt_mode: assignment.attempt_mode ?? 'single',
                        due_at: assignment.due_at ?? null,
                      };
                      if (
                        attemptsLen === 0 &&
                        !isTeacherTry &&
                        !canStartFirstAttempt(policy, new Date())
                      ) {
                        return t('assignmentDetail.noSubmissionPastDue');
                      }
                      return t('assignmentDetail.noSubmissionUnexpected');
                    })()}
                  </p>
                </CardContent>
              </Card>
            )}

            {!feedback && submission ? (
              <AssignmentDetailSubmissionRouter
                assignment={assignment}
                submission={submission}
                hasFeedback={Boolean(feedback)}
                isTeacherTry={isTeacherTry}
                isRTL={isRTL}
                resolvedStudentFacingTask={resolvedStudentFacingTask}
                isStudentTaskLoading={isStudentTaskLoading}
                chatInitAllowed={chatInitAllowed}
                initialGreetingMode={initialGreetingMode}
                storedTaskUnderstandingChoice={storedTaskUnderstandingChoice}
                chatPriorSubmissionIds={chatPriorSubmissionIds}
                nuanceTracking={nuanceTracking}
                clipboardTracking={clipboardTracking}
                companionChatAnchorRef={companionChatAnchorRef}
                assignmentFlowContinue={assignmentFlowContinue}
                onNavigateToFlowTarget={navigateToFlowTarget}
                onGoCurriculum={goCurriculum}
                onAssignmentCompleted={handleAssignmentCompleted}
                onActivityComplete={handleActivityComplete}
              />
            ) : null}
          </div>

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
                      onClick={() =>
                        navigateToFlowTarget(assignmentFlowContinue.nextIn!, {
                          priorSubmissionId:
                            assignmentFlowContinue.nextIn!.kind === 'assignment'
                              ? submission.id
                              : undefined,
                        })
                      }
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
                      onClick={() =>
                        navigateToFlowTarget(assignmentFlowContinue.firstNext!, {
                          priorSubmissionId:
                            assignmentFlowContinue.firstNext!.kind === 'assignment'
                              ? submission.id
                              : undefined,
                        })
                      }
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
    </AssignmentDetailLayout>
  );
};
