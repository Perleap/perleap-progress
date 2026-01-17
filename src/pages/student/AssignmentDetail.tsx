import { useEffect, useState, useRef } from 'react';
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
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import { ArrowLeft, Calendar, FileText, Link as LinkIcon, Download } from 'lucide-react';
import { toast } from 'sonner';
import { AssignmentChatInterface } from '@/components/AssignmentChatInterface';

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  due_at: string;
  type: string;
  classroom_id: string;
  materials?: string;
  target_dimensions: {
    vision: boolean;
    values: boolean;
    thinking: boolean;
    connection: boolean;
    action: boolean;
  };
  classrooms: {
    name: string;
    teacher_profiles: {
      full_name: string;
    } | null;
  };
}

interface Submission {
  id: string;
  text_body: string;
  submitted_at: string;
}

interface Feedback {
  student_feedback: string;
  teacher_feedback: string;
  created_at: string;
}

const AssignmentDetail = () => {
  const { t } = useTranslation();
  const { language: uiLanguage = 'en' } = useLanguage();
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastIdRef = useRef(id);
  const lastUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // ProtectedRoute handles auth, just fetch data when user is available
    if (!user?.id) {
      console.log('AssignmentDetail: No user ID yet');
      return;
    }

    console.log('AssignmentDetail: User ID available', user.id, 'Assignment ID:', id);

    // Reset refs if assignment ID or user ID changes
    if (lastIdRef.current !== id || lastUserIdRef.current !== user.id) {
      console.log('AssignmentDetail: ID changed, resetting refs');
      hasFetchedRef.current = false;
      isFetchingRef.current = false;
      lastIdRef.current = id;
      lastUserIdRef.current = user.id;
      // Also reset loading to true when ID changes
      setLoading(true);
    }

    // Only fetch if we haven't fetched yet and we're not currently fetching
    if (!hasFetchedRef.current && !isFetchingRef.current) {
      console.log('AssignmentDetail: Triggering fetchData');
      fetchData();
    } else {
      console.log('AssignmentDetail: Skipping fetchData', { hasFetched: hasFetchedRef.current, isFetching: isFetchingRef.current });
    }
  }, [id, user?.id]); // Use user?.id to avoid refetch on user object reference change

  const fetchData = async () => {
    if (isFetchingRef.current) return; // Prevent concurrent fetches

    isFetchingRef.current = true;
    console.log('AssignmentDetail: fetchData started');

    try {
      // Fetch assignment with teacher info
      const { data: assignmentData, error: assignError } = await supabase
        .from('assignments')
        .select('*, classrooms(name, teacher_id)')
        .eq('id', id)
        .maybeSingle();

      if (assignError) {
        console.error('AssignmentDetail: Error fetching assignment', assignError);
        throw assignError;
      }

      if (!assignmentData) {
        console.error('AssignmentDetail: Assignment not found');
        toast.error(t('assignmentDetail.errors.loading'));
        navigate('/student/dashboard');
        return;
      }

      console.log('AssignmentDetail: Assignment fetched', assignmentData.id);

      // Fetch teacher profile separately
      let teacherProfile: { full_name: string; avatar_url: string | null } | null = null;
      if (assignmentData.classrooms?.teacher_id) {
        const { data: tProfile } = await supabase
          .from('teacher_profiles')
          .select('full_name, avatar_url')
          .eq('user_id', assignmentData.classrooms.teacher_id)
          .maybeSingle();

        if (tProfile) {
          teacherProfile = {
            full_name: tProfile.full_name || t('common.teacher'),
            avatar_url: tProfile.avatar_url
          };
        }
      }

      setAssignment({
        ...assignmentData,
        classrooms: {
          ...assignmentData.classrooms,
          teacher_profiles: teacherProfile,
        },
      } as any);

      // Try to get or create submission
      let finalSubmission = null;

      // 1. Try to fetch existing submission first
      const { data: existingSubmission, error: fetchSubError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', id)
        .eq('student_id', user!.id)
        .maybeSingle();

      if (fetchSubError) {
        console.error('Error fetching existing submission:', fetchSubError);
        throw fetchSubError;
      }

      if (existingSubmission) {
        finalSubmission = existingSubmission;
      } else {
        // 2. If not found, try to create a new one
        console.log('Creating new submission for assignment:', id);
        const { data: newSubmission, error: createError } = await supabase
          .from('submissions')
          .insert([
            {
              assignment_id: id!,
              student_id: user!.id,
              text_body: '',
              status: 'in_progress'
            },
          ])
          .select()
          .single();

        if (createError) {
          // Check if it's a unique constraint violation (race condition)
          if (createError.code === '23505') {
            console.log('Race condition detected, fetching created submission');
            const { data: retrySubmission, error: retryError } = await supabase
              .from('submissions')
              .select('*')
              .eq('assignment_id', id)
              .eq('student_id', user!.id)
              .maybeSingle();

            if (retryError || !retrySubmission) {
              throw retryError || createError;
            }
            finalSubmission = retrySubmission;
          } else {
            throw createError;
          }
        } else {
          finalSubmission = newSubmission;
        }
      }

      // Set submission and check for feedback

      // Set submission and check for feedback
      if (finalSubmission) {
        setSubmission(finalSubmission);

        const { data: feedbackData } = await supabase
          .from('assignment_feedback')
          .select('*')
          .eq('submission_id', finalSubmission.id)
          .maybeSingle();

        if (feedbackData) {
          setFeedback(feedbackData);
          
          // Auto-heal: If feedback exists but submission is not completed, mark it as completed
          if (finalSubmission && finalSubmission.status !== 'completed') {
            console.log('Auto-healing submission status to completed');
            await completeSubmission(finalSubmission.id);
            setSubmission({ ...finalSubmission, status: 'completed' });
            // Invalidate queries to update dashboard and classroom views
            queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
          }
        }
      }
    } catch (error) {
      console.error('AssignmentDetail: Error in fetchData', error);
      toast.error(t('assignmentDetail.errors.loading'));
      navigate('/student/dashboard');
    } finally {
      console.log('AssignmentDetail: fetchData finished');
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
    }
  };

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
          }
        }
      }
    } catch (error) {
      console.error('Exception generating feedback:', error);
    }

    // Reset flags to allow refetch after completing activity
    hasFetchedRef.current = false;
    isFetchingRef.current = false;
    fetchData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Assignment not found or failed to load.</div>
      </div>
    );
  }

  const targetDimensions = Object.entries(assignment.target_dimensions)
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
