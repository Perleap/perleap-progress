import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, MessageSquare, AlertTriangle, Sparkles, User, Calendar, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { WellbeingAlertCard } from '@/components/WellbeingAlertCard';
import { StudentAnalytics } from '@/components/StudentAnalytics';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { HardSkillsAssessmentTable } from '@/components/HardSkillsAssessmentTable';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import SafeMathMarkdown from '@/components/SafeMathMarkdown';
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
    instructions: string;
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
  const [studentAvatar, setStudentAvatar] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<StudentAlert[]>([]);
  const [generatingAssignment, setGeneratingAssignment] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [generatedAssignmentData, setGeneratedAssignmentData] =
    useState<GeneratedAssignmentData | null>(null);

  // Prevent refetching when tabbing in/out
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastIdRef = useRef(id);
  const lastUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // ProtectedRoute handles auth, just fetch data when user is available
    if (!user?.id) return;

    // Reset refs if submission ID or user ID changes
    if (lastIdRef.current !== id || lastUserIdRef.current !== user.id) {
      hasFetchedRef.current = false;
      isFetchingRef.current = false;
      lastIdRef.current = id;
      lastUserIdRef.current = user.id;
    }

    // Only fetch if we haven't fetched yet and not currently fetching
    if (!hasFetchedRef.current && !isFetchingRef.current) {
      fetchData();
    }
  }, [id, user?.id]); // Use user?.id to avoid refetch on user object reference change

  const fetchData = async () => {
    if (isFetchingRef.current) return; // Prevent concurrent fetches
    isFetchingRef.current = true;
    try {
      // Fetch submission with assignment info
      const { data: submissionData, error: subError } = await supabase
        .from('submissions')
        .select('*, assignments(title, instructions, classroom_id, due_at, classrooms(name, teacher_id))')
        .eq('id', id)
        .single();

      if (subError) throw subError;
      if (!submissionData) {
        console.error('Submission not found');
        toast.error(t('submissionDetail.errors.loading'));
        navigate(-1);
        return;
      }

      // Safety check for assignment data
      if (!submissionData.assignments) {
        console.error('Assignment data missing for submission');
        toast.error(t('submissionDetail.errors.loading'));
        navigate(-1);
        return;
      }

      // Safety check for classroom data
      if (!submissionData.assignments.classrooms) {
        console.error('Classroom data missing for assignment');
        toast.error(t('submissionDetail.errors.loading'));
        navigate(-1);
        return;
      }

      // Check if this teacher owns the classroom
      const teacherId = submissionData.assignments.classrooms.teacher_id;
      if (teacherId !== user?.id) {
        console.error('Unauthorized access to submission');
        toast.error(t('submissionDetail.errors.loading'));
        navigate(-1);
        return;
      }

      setSubmission(submissionData as Submission);

      // Fetch student name
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', submissionData.student_id)
        .single();

      setStudentName(studentProfile?.full_name || 'Unknown Student');
      setStudentAvatar(studentProfile?.avatar_url);

      // Fetch feedback
      const { data: feedbackData } = await supabase
        .from('assignment_feedback')
        .select('*')
        .eq('submission_id', id)
        .maybeSingle();

      if (feedbackData) {
        setFeedback(feedbackData as unknown as Feedback);
      }

      // Fetch wellbeing alerts
      const { data: alertsData } = await supabase
        .from('student_alerts')
        .select('*')
        .eq('submission_id', id)
        .order('created_at', { ascending: false });

      if (alertsData) {
        setAlerts(alertsData as unknown as StudentAlert[]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading submission';
      console.error('Error loading submission:', errorMessage);
      toast.error('Error loading submission');
      navigate(-1);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
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
          originalAssignmentInstructions: submission.assignments.instructions,
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
    <DashboardLayout
      breadcrumbs={[
        { label: t('nav.dashboard'), href: '/teacher/dashboard' },
        { label: submission.assignments.classrooms.name, href: `/teacher/classroom/${submission.assignments.classroom_id}` },
        { label: submission.assignments.title },
        { label: studentName }
      ]}
    >
      <div className="container py-8 px-4 max-w-6xl mx-auto relative z-10">
        <div className="space-y-8">
          {/* Student Info Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-6 rounded-xl border border-white/20 shadow-sm">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-white dark:border-slate-800 shadow-md">
                <AvatarImage src={studentAvatar} alt={studentName} />
                <AvatarFallback className="bg-primary/10 text-primary text-xl">{studentName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{studentName}</h1>
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mt-1">
                  <span className="flex items-center gap-1 text-sm">
                    <BookOpen className="h-3.5 w-3.5" />
                    {submission.assignments.classrooms.name}
                  </span>
                  <span className="flex items-center gap-1 text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(submission.submitted_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {feedback && (
              <Button
                onClick={handleGenerateFollowupAssignment}
                disabled={generatingAssignment}
                className="rounded-full shadow-md hover:shadow-lg transition-all"
                size="lg"
              >
                {generatingAssignment ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t('submissionDetail.generateFollowUp')}
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Wellbeing Alerts - Show prominently at top */}
          {alerts.length > 0 && (
            <WellbeingAlertCard
              alerts={alerts}
              studentName={studentName}
              onAcknowledge={fetchData}
            />
          )}

          {feedback ? (
            <div className="grid lg:grid-cols-12 gap-8">
              {/* Left Column: Feedback & Analytics */}
              <div className="lg:col-span-7 space-y-8">
                <Card className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden">
                  <CardHeader className="bg-accent dark:bg-accent/30 pb-6">
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      {t('submissionDetail.teacherFeedback')}
                    </CardTitle>
                    <CardDescription className="text-accent-foreground/70">
                      {t('submissionDetail.teacherFeedbackDesc')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                        {feedback.teacher_feedback
                          ?.replace(/\*\*/g, '')
                          ?.replace(/\/\//g, '')
                          ?.trim() || 'No teacher feedback generated'}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-slate-500" />
                      {t('submissionDetail.studentFeedback')}
                    </CardTitle>
                    <CardDescription>
                      {t('submissionDetail.studentFeedbackDesc', { student: studentName })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-lg text-slate-600 dark:text-slate-400 italic">
                      "{feedback.student_feedback?.replace(/\*\*/g, '')?.replace(/\/\//g, '')?.trim()}"
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-8">
                  <StudentAnalytics
                    studentId={submission.student_id}
                    classroomId={submission.assignments.classroom_id}
                    currentSubmissionId={submission.id}
                  />
                </div>
              </div>

              {/* Right Column: Conversation History & CRA */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="h-[600px] flex flex-col rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden">
                  <CardHeader className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 z-10 shrink-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-5 w-5 text-primary" />
                      {t('submissionDetail.conversationHistory')}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t('submissionDetail.conversationHistoryDesc', { student: studentName })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {feedback.conversation_context &&
                      Array.isArray(feedback.conversation_context) &&
                      feedback.conversation_context.map((msg, idx) => {
                        // Check if this message triggered any alerts
                        const triggeredAlerts = alerts.flatMap((alert) =>
                          alert.triggered_messages.filter((tm) => tm.message_index === idx)
                        );
                        const isConcerning = triggeredAlerts.length > 0;
                        const isUser = msg.role === 'user';

                        return (
                          <div
                            key={idx}
                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[85%] p-4 rounded-lg relative shadow-sm ${isConcerning
                                ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
                                : isUser
                                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                                }`}
                            >
                              {isConcerning && (
                                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm z-10">
                                  <AlertTriangle className="h-3 w-3" />
                                </div>
                              )}

                              <SafeMathMarkdown content={msg.content} className="text-sm leading-relaxed" />

                              {isConcerning && triggeredAlerts.length > 0 && (
                                <div className="mt-3 pt-2 border-t border-red-200 dark:border-red-800/50 text-xs text-red-700 dark:text-red-300 bg-red-100/50 dark:bg-red-900/20 -mx-4 -mb-4 p-3 rounded-b-2xl">
                                  <strong>Why flagged:</strong> {triggeredAlerts[0].reason}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 px-1">
                              {isUser ? studentName : 'Perleap'}
                            </span>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>

                <HardSkillsAssessmentTable
                  submissionId={submission.id}
                  title={t('cra.title')}
                  description={t('classroomAnalytics.hardSkillsFor', { student: studentName })}
                />
              </div>
            </div>
          ) : (
            <Card className="rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-6">
                  <MessageSquare className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{t('submissionDetail.noFeedback')}</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md">
                  {t('submissionDetail.noFeedbackDesc')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
          initialData={generatedAssignmentData as any}
          assignedStudentId={submission.student_id}
          studentName={studentName}
        />
      )}
    </DashboardLayout>
  );
};

export default SubmissionDetail;
