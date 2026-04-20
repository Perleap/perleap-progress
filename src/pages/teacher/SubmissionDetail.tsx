import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { navigateBackOrTo } from '@/hooks/useNavigateBack';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { Card, CardContent } from '@/components/ui/card';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/useAuth';
import { MessageSquare, Sparkles, Calendar, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFullSubmissionDetails } from '@/hooks/queries';
import { SubmissionTabs } from '@/components/features/submission/SubmissionTabs';

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
  
  const { data: submissionData, isLoading: loading, refetch } = useFullSubmissionDetails(id);

  const [generatingAssignment, setGeneratingAssignment] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [generatedAssignmentData, setGeneratedAssignmentData] =
    useState<GeneratedAssignmentData | null>(null);

  const submission = submissionData;
  const feedback = submissionData?.feedback;
  const rawStudentName = submissionData?.student_name;
  const studentName = rawStudentName && rawStudentName.trim() !== '' 
    ? rawStudentName 
    : t('common.student');
  const studentAvatar = submissionData?.student_avatar_url;
  const alerts = submissionData?.alerts || [];

  // Check ownership
  useMemo(() => {
    if (submissionData && user?.id) {
      const teacherId = submissionData.assignments?.classrooms?.teacher_id;
      if (teacherId && teacherId !== user.id) {
        console.error('Unauthorized access to submission');
        toast.error(t('submissionDetail.errors.loading'));
        navigateBackOrTo(navigate, '/teacher/dashboard');
      }
    }
  }, [submissionData, user?.id, navigate, t]);

  const handleGenerateFollowupAssignment = async () => {
    if (!feedback || !submission) return;

    setGeneratingAssignment(true);
    console.log('Generating follow-up for student:', studentName, 'ID:', submission.student_id);
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

      let fnErrorPayload: unknown = null;
      if (error instanceof FunctionsHttpError) {
        try {
          fnErrorPayload = await error.context.clone().json();
        } catch {
          try {
            fnErrorPayload = await error.context.clone().text();
          } catch {
            fnErrorPayload = null;
          }
        }
      }

      // #region agent log
      fetch('http://127.0.0.1:7672/ingest/06e8b4df-1f3c-431c-8504-c340b8e8e7e8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd6fa3a' },
        body: JSON.stringify({
          sessionId: 'd6fa3a',
          runId: 'pre-fix',
          hypothesisId: 'H1-H5',
          location: 'SubmissionDetail.tsx:invoke-followup',
          message: 'generate-followup-assignment invoke result',
          data: {
            hasError: !!error,
            errorName: error instanceof Error ? error.name : null,
            errorMessage: error instanceof Error ? error.message : null,
            fnErrorPayload,
            hasData: data != null,
            dataKeys:
              data != null && typeof data === 'object' ? Object.keys(data as object) : [],
            bodyPreview: {
              hasTeacherFeedback: !!feedback?.teacher_feedback,
              hasStudentFeedback: !!feedback?.student_feedback,
              conversationContextIsArray: Array.isArray(feedback?.conversation_context),
              conversationLen: Array.isArray(feedback?.conversation_context)
                ? feedback.conversation_context.length
                : null,
            },
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      if (error) {
        const serverMsg =
          fnErrorPayload &&
          typeof fnErrorPayload === 'object' &&
          'error' in fnErrorPayload &&
          typeof (fnErrorPayload as { error: unknown }).error === 'string'
            ? (fnErrorPayload as { error: string }).error.trim()
            : '';
        throw new Error(serverMsg || error.message);
      }

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

  if (loading && !submissionData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!submissionData) return null;

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
                className="rounded-full shadow-sm hover:shadow-md transition-all text-sm h-9 px-4"
                size="sm"
              >
                {generatingAssignment ? (
                  <>
                    <span className="animate-spin me-2">⏳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="me-2 h-3.5 w-3.5" />
                    {t('submissionDetail.generateFollowUp')}
                  </>
                )}
              </Button>
            )}
          </div>

          {(() => {
            const MANUAL_EVAL_TYPES = ['project', 'presentation', 'langchain'];
            const AI_EVAL_TYPES = ['text_essay', 'test', 'questions', 'chatbot'];
            const isManualEvalType = MANUAL_EVAL_TYPES.includes(submission.assignments?.type);
            const needsTeacherAiEvaluation =
              submission.status === 'completed' &&
              !feedback &&
              AI_EVAL_TYPES.includes(submission.assignments?.type);
            const showTabs = feedback || isManualEvalType || needsTeacherAiEvaluation;

            return showTabs ? (
              <SubmissionTabs
                submission={submission}
                feedback={feedback}
                studentName={studentName}
                alerts={alerts}
                onAcknowledgeAlert={refetch}
                onEvaluationComplete={refetch}
              />
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
            );
          })()}
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
