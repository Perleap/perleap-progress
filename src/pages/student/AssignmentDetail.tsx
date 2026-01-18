import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { generateFeedback, completeSubmission } from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { assignmentKeys, useStudentAssignmentDetails } from '@/hooks/queries';
import { Calendar, FileText, Link as LinkIcon, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AssignmentChatInterface } from '@/components/AssignmentChatInterface';

const AssignmentDetail = () => {
  const { t } = useTranslation();
  const { language: uiLanguage = 'en' } = useLanguage();
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: assignmentData, isLoading: loading, refetch } = useStudentAssignmentDetails(id);

  const assignment = assignmentData;
  const submission = assignmentData?.submission;
  const feedback = assignmentData?.feedback;

  const handleActivityComplete = async () => {
    try {
      // Trigger feedback generation
      if (assignment && submission && user) {
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
          // Mark submission as completed
          const { error: completeError } = await completeSubmission(submission.id);

          if (completeError) {
            console.error('Error completing submission:', completeError);
            toast.error(t('common.error'));
          } else {
            toast.success(t('assignmentDetail.success.completed'));
            // Invalidate queries to update dashboard and classroom views
            queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
            refetch(); // Reload assignment details to show feedback
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

  const targetDimensions = Object.entries(assignment.target_dimensions || {})
    .filter(([_, value]) => value)
    .map(([key]) => key);

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

              {targetDimensions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">{t('assignmentDetail.learningDimensions')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {targetDimensions.map((dimension) => (
                      <Badge key={dimension} variant="outline" className="capitalize">
                        {dimension}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

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

          {!feedback && submission && (
            <AssignmentChatInterface
              assignmentId={assignment.id}
              assignmentTitle={assignment.title}
              teacherName={assignment.classrooms.teacher_profiles?.full_name || 'Teacher'}
              assignmentInstructions={assignment.instructions}
              submissionId={submission.id}
              onComplete={handleActivityComplete}
            />
          )}

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
