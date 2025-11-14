import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Calendar, FileText, Link as LinkIcon, Download } from 'lucide-react';
import { toast } from 'sonner';
import { AssignmentChatInterface } from '@/components/AssignmentChatInterface';

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  due_at: string;
  type: string;
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
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    // ProtectedRoute handles auth, just fetch data when user is available
    // Only fetch if we haven't fetched yet and we're not currently fetching
    if (user?.id && !hasFetchedRef.current && !isFetchingRef.current) {
      fetchData();
    }
  }, [id, user?.id]); // Use user?.id to avoid refetch on user object reference change

  const fetchData = async () => {
    if (isFetchingRef.current) return; // Prevent concurrent fetches

    isFetchingRef.current = true;

    try {
      // Fetch assignment with teacher info
      const { data: assignmentData, error: assignError } = await supabase
        .from('assignments')
        .select('*, classrooms(name, teacher_id)')
        .eq('id', id)
        .maybeSingle();

      if (assignError) throw assignError;

      if (!assignmentData) {
        toast.error(t('assignmentDetail.errors.loading'));
        navigate('/student/dashboard');
        return;
      }

      // Fetch teacher profile separately
      let teacherName = 'Teacher';
      if (assignmentData.classrooms?.teacher_id) {
        const { data: teacherProfile } = await supabase
          .from('teacher_profiles')
          .select('full_name')
          .eq('user_id', assignmentData.classrooms.teacher_id)
          .maybeSingle();

        if (teacherProfile?.full_name) {
          teacherName = teacherProfile.full_name;
        }
      }

      setAssignment({
        ...assignmentData,
        classrooms: {
          ...assignmentData.classrooms,
          teacher_profiles: { full_name: teacherName },
        },
      } as any);

      // Try to get or create submission using upsert to handle conflicts
      let finalSubmission = null;

      const { data: submissionData, error: subError } = await supabase
        .from('submissions')
        .upsert(
          {
            assignment_id: id!,
            student_id: user!.id,
            text_body: '',
          },
          {
            onConflict: 'assignment_id,student_id',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (subError) {
        // If upsert fails, try to fetch existing submission
        const { data: existingSubmission } = await supabase
          .from('submissions')
          .select('*')
          .eq('assignment_id', id)
          .eq('student_id', user?.id)
          .maybeSingle();

        if (existingSubmission) {
          finalSubmission = existingSubmission;
        } else {
          throw subError;
        }
      } else {
        finalSubmission = submissionData;
      }

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
        }
      }
    } catch (error) {
      toast.error(t('assignmentDetail.errors.loading'));
      navigate('/student/dashboard');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
    }
  };

  const handleActivityComplete = () => {
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

  if (!assignment) return null;

  const targetDimensions = Object.entries(assignment.target_dimensions)
    .filter(([_, value]) => value)
    .map(([key]) => key);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title={assignment.title}
        subtitle={assignment.classrooms.name}
        userType="student"
        showBackButton
      />

      <main className="container py-4 md:py-8 px-4 max-w-4xl">
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
                <Badge variant="secondary">{assignment.type.replace('_', ' ')}</Badge>
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
                  <h3 className="font-semibold mb-2">Learning Dimensions</h3>
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
                          <h3 className="font-semibold mb-2">Course Materials</h3>
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
                                    Download
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(material.url, '_blank')}
                                    className="gap-2"
                                  >
                                    <LinkIcon className="h-4 w-4" />
                                    Open
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
                <div className="prose prose-sm max-w-none">
                  {feedback.student_feedback?.replace(/\*\*/g, '')?.replace(/\/\//g, '')?.trim()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AssignmentDetail;
