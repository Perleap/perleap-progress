import { MessageSquare } from 'lucide-react';
import type React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type { SubmissionDetailLocationState } from '@/types/navigation';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { SubmissionDetailHeader } from '@/components/features/submission/SubmissionDetailHeader';
import { SubmissionTabs } from '@/components/features/submission/SubmissionTabs';
import { ClassroomLayout } from '@/components/layouts';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/useAuth';
import {
  useFullSubmissionDetails,
  useClassroom,
  useTeacherResetStudentAssignmentProgress,
} from '@/hooks/queries';
import { navigateBackOrTo } from '@/hooks/useNavigateBack';
import { getTeacherClassroomNavSections } from '@/lib/classroomNavSections';
import { generateFollowupAssignment } from '@/services/submissionService';
import { isAppAdminRole } from '@/utils/role';

interface GeneratedAssignmentData {
  title: string;
  instructions: string;
  type: string;
  difficulty_level?: string;
  success_criteria?: string[];
  scaffolding_tips?: string;
  target_dimensions: Record<string, boolean>;
  due_at: string;
  opik_trace_ids?: Record<string, string>;
}

export type SubmissionDetailContentProps = {
  submissionId: string;
};

export const SubmissionDetailContent = ({ submissionId }: SubmissionDetailContentProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    data: submissionData,
    isLoading: loading,
    refetch,
  } = useFullSubmissionDetails(submissionId);
  const classroomId = submissionData?.assignments?.classroom_id;
  const { data: classroomRow } = useClassroom(classroomId);
  const resetProgress = useTeacherResetStudentAssignmentProgress();

  const [generatingAssignment, setGeneratingAssignment] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [resetProgressOpen, setResetProgressOpen] = useState(false);
  const [generatedAssignmentData, setGeneratedAssignmentData] =
    useState<GeneratedAssignmentData | null>(null);

  const submission = submissionData;
  const feedback = submissionData?.feedback;
  const rawStudentName = submissionData?.student_name;
  const studentName =
    rawStudentName && rawStudentName.trim() !== '' ? rawStudentName : t('common.student');
  const studentAvatar = submissionData?.student_avatar_url;
  const alerts = submissionData?.alerts || [];

  const canTeacherStartNewStudentAttempt =
    submission && !submission.is_teacher_attempt && submission.status === 'completed';

  useEffect(() => {
    if (submissionData && user?.id) {
      const teacherId = submissionData.assignments?.classrooms?.teacher_id;
      if (teacherId && teacherId !== user.id && !isAppAdminRole(user.user_metadata?.role)) {
        console.error('Unauthorized access to submission');
        toast.error(t('submissionDetail.errors.loading'));
        navigateBackOrTo(navigate, '/teacher/dashboard');
      }
    }
  }, [submissionData, user?.id, navigate, t, user?.user_metadata?.role]);

  const customSections = useMemo(() => getTeacherClassroomNavSections(t), [t]);
  const submissionNavState = location.state as SubmissionDetailLocationState | null;

  const navigateToClassroomSection = useCallback(
    (section: string, replace = false) => {
      if (!classroomId) {
        navigateBackOrTo(navigate, '/teacher/dashboard');
        return;
      }
      const returnTo = submissionNavState?.returnTo;
      if (returnTo) {
        const q = returnTo.indexOf('?');
        const pathname = q >= 0 ? returnTo.slice(0, q) : returnTo;
        const search = q >= 0 ? returnTo.slice(q) : '';
        navigate({ pathname, search }, { replace, state: { activeSection: section } });
        return;
      }
      navigate(`/teacher/classroom/${classroomId}`, { replace, state: { activeSection: section } });
    },
    [classroomId, submissionNavState?.returnTo, navigate]
  );

  const handleBackToSubmissions = useCallback(() => {
    navigateToClassroomSection('submissions');
  }, [navigateToClassroomSection]);

  const handleClassroomNav = useCallback(
    (section: string) => {
      navigateToClassroomSection(section, true);
    },
    [navigateToClassroomSection]
  );

  const handleGenerateFollowupAssignment = async () => {
    if (!feedback || !submission) return;

    setGeneratingAssignment(true);
    console.log('Generating follow-up for student:', studentName, 'ID:', submission.student_id);
    try {
      const data = await generateFollowupAssignment({
        submissionId: submission.id,
        teacherFeedback: feedback.teacher_feedback ?? '',
        studentFeedback: feedback.student_feedback ?? '',
        conversationContext: feedback.conversation_context,
        originalAssignmentTitle: submission.assignments.title,
        originalAssignmentInstructions: submission.assignments.instructions,
        studentName,
      });

      let defaultDueDate = '';
      const originalDueDate = submission.assignments.due_at;
      if (originalDueDate) {
        const oneWeekLater = new Date(originalDueDate);
        oneWeekLater.setDate(oneWeekLater.getDate() + 7);
        defaultDueDate = oneWeekLater.toISOString().slice(0, 16);
      }

      setGeneratedAssignmentData({
        title: data.title,
        instructions: data.instructions,
        type: data.type,
        difficulty_level: data.difficulty_level,
        success_criteria: data.success_criteria,
        scaffolding_tips: data.scaffolding_tips,
        target_dimensions: data.target_dimensions,
        due_at: defaultDueDate,
        opik_trace_ids: data.opikTraceId ? { instructions: data.opikTraceId } : undefined,
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

  const handleConfirmResetStudentProgress = async () => {
    if (!submission?.id) return;
    try {
      const newId = await resetProgress.mutateAsync({
        submissionId: submission.id,
        notify: {
          studentId: submission.student_id,
          assignmentId: submission.assignments.id,
          assignmentTitle: submission.assignments.title,
          classroomId: submission.assignments.classroom_id,
          teacherId: submission.assignments.classrooms?.teacher_id ?? user?.id ?? null,
        },
        notificationCopy: {
          title: t('notifications.newAttempt.title', {
            assignmentTitle: submission.assignments.title,
          }),
          message: t('notifications.newAttempt.message'),
        },
      });
      setResetProgressOpen(false);
      toast.success(t('submissionDetail.resetStudentProgress.success'));
      navigate(`/teacher/submission/${newId}`, { state: location.state });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('student_already_has_draft')) {
        toast.error(t('submissionDetail.resetStudentProgress.blockedDraft'));
      } else {
        toast.error(t('common.error'));
      }
    }
  };

  if (loading && !submissionData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!submissionData || !submission) return null;

  const classroomName = submission.assignments.classrooms.name;
  const classroomSubject = classroomRow?.subject;

  const MANUAL_EVAL_TYPES = ['project', 'presentation', 'langchain'];
  const AI_EVAL_TYPES = ['text_essay', 'test', 'questions', 'chatbot'];
  const isManualEvalType = MANUAL_EVAL_TYPES.includes(submission.assignments?.type);
  const needsTeacherAiEvaluation =
    submission.status === 'completed' &&
    !feedback &&
    AI_EVAL_TYPES.includes(submission.assignments?.type);
  const showTabs = feedback || isManualEvalType || needsTeacherAiEvaluation;

  return (
    <ClassroomLayout
      classroomName={classroomName}
      classroomSubject={classroomSubject}
      activeSection="submissions"
      onSectionChange={handleClassroomNav}
      onBack={handleBackToSubmissions}
      customSections={customSections}
    >
      <div className="container py-0 px-4 max-w-6xl mx-auto relative z-10">
        <div className="space-y-8 pb-8">
          <SubmissionDetailHeader
            studentName={studentName}
            studentAvatar={studentAvatar}
            classroomName={submission.assignments.classrooms.name}
            submittedAt={submission.submitted_at ?? ''}
            canResetProgress={!!canTeacherStartNewStudentAttempt}
            resetProgressOpen={resetProgressOpen}
            onResetProgressOpenChange={setResetProgressOpen}
            onResetConfirm={handleConfirmResetStudentProgress}
            resetPending={resetProgress.isPending}
            hasFeedback={!!feedback}
            generatingAssignment={generatingAssignment}
            onGenerateFollowup={handleGenerateFollowupAssignment}
          />

          {showTabs ? (
            <SubmissionTabs
              submission={
                {
                  ...submission,
                  assignments: {
                    ...submission.assignments,
                    opik_trace_ids: submission.assignments.opik_trace_ids as
                      | Record<string, string>
                      | null
                      | undefined,
                  },
                } as React.ComponentProps<typeof SubmissionTabs>['submission']
              }
              feedback={feedback ?? null}
              studentName={studentName}
              alerts={alerts as unknown as React.ComponentProps<typeof SubmissionTabs>['alerts']}
              onAcknowledgeAlert={refetch}
              onEvaluationComplete={refetch}
            />
          ) : (
            <Card className="rounded-xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-6">
                  <MessageSquare className="h-10 w-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                  {t('submissionDetail.noFeedback')}
                </h3>
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
    </ClassroomLayout>
  );
};
