import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { generateFeedback, completeSubmission, startNewSubmissionAttempt } from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { assignmentKeys, useStudentAssignmentDetails } from '@/hooks/queries';
import { Calendar, FileText, Link as LinkIcon, Download, Loader2, Clock, RefreshCw, Lock } from 'lucide-react';
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
import type { AssignmentCompletionTone } from '@/types/submission';

const NON_CHAT_ASSIGNMENT_TYPES = ['test', 'project', 'presentation', 'langchain', 'text_essay'] as const;

const AssignmentDetail = () => {
  const { t } = useTranslation();
  const { language: uiLanguage = 'en', isRTL } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [retryLoading, setRetryLoading] = useState(false);
  const [completionModal, setCompletionModal] = useState<{
    open: boolean;
    tone: AssignmentCompletionTone;
  }>({ open: false, tone: 'activityCompleted' });

  const { data: assignmentData, isLoading: loading, refetch } = useStudentAssignmentDetails(id);

  const sectionFlow = useStudentSectionModuleFlow(
    assignmentData?.classroom_id,
    assignmentData?.syllabus_section_id ?? undefined,
    user?.id,
  );

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
    enabled:
      !!assignment &&
      !!submission &&
      !feedback &&
      !NON_CHAT_ASSIGNMENT_TYPES.includes(
        assignment.type as (typeof NON_CHAT_ASSIGNMENT_TYPES)[number],
      ),
  });

  const handleAssignmentCompleted = useCallback(
    async (tone: AssignmentCompletionTone = 'activityCompleted') => {
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      await refetch();
      setCompletionModal({ open: true, tone });
    },
    [queryClient, refetch],
  );

  const completionModalDescription = (tone: AssignmentCompletionTone): string => {
    switch (tone) {
      case 'activityCompleted':
        return t('assignmentDetail.success.completed');
      case 'awaitingTeacher':
        return t('assignmentDetail.success.submittedAwaitingTeacher');
      case 'awaitingReview':
        if (!assignment) return '';
        return t(`assignmentDetail.${assignment.type}.awaitingReview`);
      case 'testSubmitted':
        return t('assignmentDetail.testTaking.submitSuccess');
      default:
        return t('assignmentDetail.success.completed');
    }
  };

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

  const handleActivityComplete = async () => {
    try {
      if (assignment && submission && user) {
        const autoPublish = assignment.auto_publish_ai_feedback !== false;

        if (!autoPublish) {
          const { error: completeError } = await completeSubmission(submission.id, {
            awaitingTeacherFeedbackRelease: true,
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
          const { error: completeError } = await completeSubmission(submission.id);

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
      <DashboardLayout>
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
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: t('nav.dashboard'), href: '/student/dashboard' },
        { label: assignment.classrooms.name, href: `/student/classroom/${assignment.classroom_id}` },
        { label: assignment.title }
      ]}
    >
      <div className="container py-4 px-0 max-w-4xl">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle>{t('assignmentDetail.title')}</CardTitle>
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
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{t('assignmentDetail.instructions')}</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {assignment.instructions}
                </p>
              </div>

              {/* Course Materials Section */}
              {assignment.materials &&
                (() => {
                  try {
                    // Handle both JSONB (object) and old TEXT (string) formats
                    const materials = typeof assignment.materials === 'string'
                      ? JSON.parse(assignment.materials)
                      : assignment.materials;
                    if (Array.isArray(materials) && materials.length > 0) {
                      return (
                        <div>
                          <h3 className="font-semibold mb-2">{t('assignmentDetail.courseMaterials')}</h3>
                          <div className="space-y-2">
                            {materials.map((material, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 p-3 bg-muted/50 rounded-md hover:bg-muted transition-colors"
                              >
                                {material.type === 'pdf' ? (
                                  <FileText className="h-5 w-5 text-primary" />
                                ) : (
                                  <LinkIcon className="h-5 w-5 text-primary" />
                                )}
                                <span className="flex-1 text-sm font-medium truncate">
                                  {material.name}
                                </span>
                                {material.type === 'pdf' ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(material.url, '_blank')}
                                    className="gap-2"
                                  >
                                    <Download className="h-4 w-4" />
                                    {t('assignmentDetail.download')}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(material.url, '_blank')}
                                    className="gap-2"
                                  >
                                    <LinkIcon className="h-4 w-4" />
                                    {t('assignmentDetail.open')}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  } catch (e) {
                    // Ignore parsing errors
                  }
                  return null;
                })()}
            </CardContent>
          </Card>

          {!feedback && submission && (() => {
            const MANUAL_EVAL_TYPES = ['project', 'presentation', 'langchain'];
            const isManualEvalType = MANUAL_EVAL_TYPES.includes(assignment.type);
            const isCompleted = submission.status === 'completed';

            if (isCompleted && submission.awaiting_teacher_feedback_release) {
              return (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="h-10 w-10 text-primary mb-4" />
                    <p className="text-sm font-medium text-primary">
                      {t('assignmentDetail.awaitingTeacherFeedback')}
                    </p>
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
                  </CardContent>
                </Card>
              );
            }

            switch (assignment.type) {
              case 'test':
                return (
                  <TestTakingPage
                    assignmentId={assignment.id}
                    assignmentInstructions={assignment.instructions}
                    submissionId={submission.id}
                    autoPublishAiFeedback={assignment.auto_publish_ai_feedback !== false}
                    onComplete={handleAssignmentCompleted}
                  />
                );
              case 'text_essay':
                return (
                  <EssaySubmissionPage
                    assignmentId={assignment.id}
                    submissionId={submission.id}
                    assignmentInstructions={assignment.instructions}
                    autoPublishAiFeedback={assignment.auto_publish_ai_feedback !== false}
                    initialText={submission.text_body}
                    onComplete={handleAssignmentCompleted}
                  />
                );
              case 'project':
                return (
                  <ProjectSubmissionPage
                    assignmentId={assignment.id}
                    submissionId={submission.id}
                    onComplete={handleAssignmentCompleted}
                  />
                );
              case 'presentation':
                return (
                  <PresentationSubmissionPage
                    assignmentId={assignment.id}
                    submissionId={submission.id}
                    onComplete={handleAssignmentCompleted}
                  />
                );
              case 'langchain':
                return (
                  <LangchainBuilderPage
                    assignmentId={assignment.id}
                    submissionId={submission.id}
                    initialPipelineText={submission.text_body}
                    onComplete={handleAssignmentCompleted}
                  />
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

          {canRetry && submission?.status === 'completed' && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleStartNewAttempt()}
                disabled={retryLoading}
                className="gap-2"
              >
                {retryLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {t('assignmentDetail.startNewAttempt')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={completionModal.open}
        onOpenChange={(open) => setCompletionModal((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="rounded-xl">
          <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <AlertDialogTitle>{t('assignmentDetail.completionModal.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {completionModalDescription(completionModal.tone)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse sm:flex-row-reverse' : ''}>
            <AlertDialogAction onClick={() => setCompletionModal((prev) => ({ ...prev, open: false }))}>
              {t('assignmentDetail.completionModal.dismiss')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AssignmentDetail;
