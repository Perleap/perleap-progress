import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, MessageSquare, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { WellbeingAlertCard } from '@/components/WellbeingAlertCard';
import { StudentAnalytics } from '@/components/StudentAnalytics';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { HardSkillsAssessmentTable } from '@/components/HardSkillsAssessmentTable';
import type { StudentAlert } from '@/types/alerts';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Submission {
  id: string;
  submitted_at: string;
  student_id: string;
  assignment_id: string;
  assignments: {
    title: string;
    due_at: string;
    classroom_id: string;
    classrooms: {
      name: string;
      teacher_id: string;
    };
  };
}

interface Feedback {
  student_feedback: string;
  teacher_feedback: string;
  created_at: string;
  conversation_context: ConversationMessage[] | null;
}

interface GeneratedAssignmentData {
  title: string;
  instructions: string;
  type: string;
  difficulty_level?: string;
  success_criteria?: string[];
  scaffolding_tips?: string;
  target_dimensions: Record<string, boolean>;
  due_at: string;
}

const SubmissionDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<StudentAlert[]>([]);
  const [generatingAssignment, setGeneratingAssignment] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [generatedAssignmentData, setGeneratedAssignmentData] =
    useState<GeneratedAssignmentData | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [id, user?.id]); // Use user?.id to avoid refetch on user object reference change

  const fetchData = async () => {
    try {
      // Fetch submission with assignment info
      const { data: submissionData, error: subError } = await supabase
        .from('submissions')
        .select('*, assignments(title, classroom_id, due_at, classrooms(name, teacher_id))')
        .eq('id', id)
        .single();

      if (subError) throw subError;
      if (!submissionData) {
        toast.error(t('submissionDetail.errors.loading'));
        navigate(-1);
        return;
      }

      // Check if this teacher owns the classroom
      const teacherId = submissionData.assignments.classrooms.teacher_id;
      if (teacherId !== user?.id) {
        toast.error(t('submissionDetail.errors.loading'));
        navigate(-1);
        return;
      }

      setSubmission(submissionData as Submission);

      // Fetch student name
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('full_name')
        .eq('user_id', submissionData.student_id)
        .single();

      setStudentName(studentProfile?.full_name || 'Unknown Student');

      // Fetch feedback
      const { data: feedbackData } = await supabase
        .from('assignment_feedback')
        .select('*')
        .eq('submission_id', id)
        .maybeSingle();

      if (feedbackData) {
        setFeedback(feedbackData);
      }

      // Fetch wellbeing alerts
      const { data: alertsData } = await supabase
        .from('student_alerts')
        .select('*')
        .eq('submission_id', id)
        .order('created_at', { ascending: false });

      if (alertsData) {
        setAlerts(alertsData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading submission';
      console.error('Error loading submission:', errorMessage);
      toast.error('Error loading submission');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFollowupAssignment = async () => {
    if (!feedback || !submission) return;

    setGeneratingAssignment(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-followup-assignment', {
        body: {
          teacherFeedback: feedback.teacher_feedback,
          studentFeedback: feedback.student_feedback,
          conversationContext: feedback.conversation_context,
          originalAssignmentTitle: submission.assignments.title,
          studentName: studentName,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Calculate default due date: 1 week after original assignment due date
      let defaultDueDate = '';
      const originalDueDate = submission.assignments.due_at;
      if (originalDueDate) {
        const oneWeekLater = new Date(originalDueDate);
        oneWeekLater.setDate(oneWeekLater.getDate() + 7);
        // Format for datetime-local input: YYYY-MM-DDTHH:MM
        defaultDueDate = oneWeekLater.toISOString().slice(0, 16);
      }

      // Store the generated data and open the dialog
      setGeneratedAssignmentData({
        title: data.title,
        instructions: data.instructions,
        type: data.type,
        difficulty_level: data.difficulty_level,
        success_criteria: data.success_criteria,
        scaffolding_tips: data.scaffolding_tips,
        target_dimensions: data.target_dimensions,
        due_at: defaultDueDate,
      });
      setAssignmentDialogOpen(true);

      toast.success('AI-generated assignment ready for review!');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to generate assignment. Please try again.';
      console.error('Error generating follow-up assignment:', error);
      toast.error(errorMessage);
    } finally {
      setGeneratingAssignment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!submission) return null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        title={`${t('submissionDetail.title')}: ${studentName}`}
        subtitle={`${submission.assignments.title} - ${new Date(submission.submitted_at).toLocaleDateString()}`}
        userType="teacher"
        showBackButton
      />

      <main className="container py-8 max-w-5xl">
        <div className="space-y-6">
          {/* Wellbeing Alerts - Show prominently at top */}
          {alerts.length > 0 && (
            <WellbeingAlertCard
              alerts={alerts}
              studentName={studentName}
              onAcknowledge={fetchData}
            />
          )}

          {feedback && (
            <>
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-primary">
                        {t('submissionDetail.teacherFeedback')}
                      </CardTitle>
                      <CardDescription>
                        AI-generated analysis and recommendations based on {studentName}'s learning
                        conversation
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleGenerateFollowupAssignment}
                      disabled={generatingAssignment}
                      className="flex items-center gap-2"
                    >
                      {generatingAssignment ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate Follow-up Assignment
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    {feedback.teacher_feedback
                      ?.replace(/\*\*/g, '')
                      ?.replace(/\/\//g, '')
                      ?.trim() || 'No teacher feedback generated'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('submissionDetail.studentFeedback')}</CardTitle>
                  <CardDescription>
                    What {studentName} saw after completing the assignment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    {feedback.student_feedback?.replace(/\*\*/g, '')?.replace(/\/\//g, '')?.trim()}
                  </div>
                </CardContent>
              </Card>

              <StudentAnalytics
                studentId={submission.student_id}
                classroomId={submission.assignments.classroom_id}
                currentSubmissionId={submission.id}
              />

              <HardSkillsAssessmentTable
                submissionId={submission.id}
                title="Content Related Abilities (CRA)"
                description={`Hard skills assessment for ${studentName}'s performance`}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Conversation History
                  </CardTitle>
                  <CardDescription>
                    Complete conversation between {studentName} and Perleap
                    {alerts.length > 0 && (
                      <span className="text-red-600 font-semibold ml-2">
                        • Concerning messages are highlighted in red
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {feedback.conversation_context &&
                      Array.isArray(feedback.conversation_context) &&
                      feedback.conversation_context.map((msg, idx) => {
                        // Check if this message triggered any alerts
                        const triggeredAlerts = alerts.flatMap((alert) =>
                          alert.triggered_messages.filter((tm) => tm.message_index === idx)
                        );
                        const isConcerning = triggeredAlerts.length > 0;

                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-lg relative ${
                              isConcerning
                                ? 'bg-red-50 border-2 border-red-400 ml-8'
                                : msg.role === 'user'
                                  ? 'bg-primary/10 ml-8'
                                  : 'bg-muted mr-8'
                            }`}
                          >
                            {isConcerning && (
                              <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                                <AlertTriangle className="h-4 w-4" />
                              </div>
                            )}
                            <div className="font-semibold mb-1 text-sm flex items-center gap-2">
                              {msg.role === 'user' ? studentName : 'Perleap'}
                              {isConcerning && (
                                <Badge variant="destructive" className="text-xs">
                                  Concerning
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                            {isConcerning && triggeredAlerts.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-red-300 text-xs text-red-700">
                                <strong>Why flagged:</strong> {triggeredAlerts[0].reason}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!feedback && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('submissionDetail.noFeedback')}</h3>
                <p className="text-muted-foreground text-center">
                  This student hasn't completed the assignment yet
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {submission && (
        <CreateAssignmentDialog
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          classroomId={submission.assignments.classroom_id}
          onSuccess={() => {
            toast.success(t('createAssignment.success.created'));
            setAssignmentDialogOpen(false);
            setGeneratedAssignmentData(null);
          }}
          initialData={generatedAssignmentData}
          assignedStudentId={submission.student_id}
          studentName={studentName}
        />
      )}
    </div>
  );
};

export default SubmissionDetail;
