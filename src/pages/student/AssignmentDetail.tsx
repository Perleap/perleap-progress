import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { generateFeedback, completeSubmission } from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { assignmentKeys, useStudentAssignmentDetails } from '@/hooks/queries';
import { Calendar, FileText, Link as LinkIcon, Download, Loader2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { AssignmentChatInterface } from '@/components/AssignmentChatInterface';
import { TestTakingPage } from '@/components/features/assignment/TestTakingPage';
import { ProjectSubmissionPage } from '@/components/features/assignment/ProjectSubmissionPage';
import { PresentationSubmissionPage } from '@/components/features/assignment/PresentationSubmissionPage';
import { LangchainBuilderPage } from '@/components/features/assignment/LangchainBuilderPage';
import { EssaySubmissionPage } from '@/components/features/assignment/EssaySubmissionPage';
import { useNuanceTracking } from '@/hooks/useNuanceTracking';

const NON_CHAT_ASSIGNMENT_TYPES = ['test', 'project', 'presentation', 'langchain', 'text_essay'] as const;

const AssignmentDetail = () => {
  const { t } = useTranslation();
  const { language: uiLanguage = 'en' } = useLanguage();
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: assignmentData, isLoading: loading, refetch } = useStudentAssignmentDetails(id);

  const assignment = assignmentData;
  const submission = assignmentData?.submission;
  const feedback = assignmentData?.feedback;

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
            toast.success(t('assignmentDetail.success.submittedAwaitingTeacher'));
            queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
            refetch();
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
            toast.success(t('assignmentDetail.success.completed'));
            queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
            refetch();
          }
        }
      }
    } catch (error) {
      console.error('Exception generating feedback:', error);
    }
  };

  if (loading && !assignmentData) {
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
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Calendar className="h-4 w-4" />
                    {assignment.due_at &&
                      `${t('assignmentDetail.dueDate')}: ${new Date(assignment.due_at).toLocaleString()}`}
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
                    onComplete={() => refetch()}
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
                    onComplete={() => refetch()}
                  />
                );
              case 'project':
                return (
                  <ProjectSubmissionPage
                    assignmentId={assignment.id}
                    submissionId={submission.id}
                    onComplete={() => refetch()}
                  />
                );
              case 'presentation':
                return (
                  <PresentationSubmissionPage
                    assignmentId={assignment.id}
                    submissionId={submission.id}
                    onComplete={() => refetch()}
                  />
                );
              case 'langchain':
                return (
                  <LangchainBuilderPage
                    assignmentId={assignment.id}
                    submissionId={submission.id}
                    initialPipelineText={submission.text_body}
                    onComplete={() => refetch()}
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
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AssignmentDetail;
