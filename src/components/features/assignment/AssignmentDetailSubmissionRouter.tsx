import { ChevronRight, Clock, CheckCircle } from 'lucide-react';
import { type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentClipboardTrackingCallbacks } from '@/hooks/useAssignmentClipboardTracking';
import type { NuanceTrackingCallbacks } from '@/hooks/useNuanceTracking';
import type { FlowStepTarget } from '@/lib/moduleFlowNavigation';
import type { AssignmentCompletionTone } from '@/types/submission';
import { AssignmentDetailChatPanel } from '@/components/features/assignment/AssignmentDetailChatPanel';
import { EssaySubmissionPage } from '@/components/features/assignment/EssaySubmissionPage';
import { LangchainBuilderPage } from '@/components/features/assignment/LangchainBuilderPage';
import { PresentationSubmissionPage } from '@/components/features/assignment/PresentationSubmissionPage';
import { ProjectSubmissionPage } from '@/components/features/assignment/ProjectSubmissionPage';
import { TestTakingPage } from '@/components/features/assignment/TestTakingPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EVALUATION_STATUS } from '@/config/constants';
type RouterAssignment = {
  id: string;
  type: string;
  title: string;
  instructions: string;
  student_facing_task?: string | null;
  enable_ai_feedback?: boolean | null;
  auto_publish_ai_feedback?: boolean | null;
  syllabus_section_id?: string | null;
  classrooms: {
    teacher_profiles?: { full_name?: string | null } | null;
  };
};

type RouterSubmission = {
  id: string;
  status: string;
  student_id: string;
  text_body?: string | null;
  awaiting_teacher_feedback_release?: boolean | null;
  evaluation_status?: string | null;
};

export type AssignmentFlowContinue = {
  nextIn: FlowStepTarget | null;
  firstNext: FlowStepTarget | null;
  nextModId: string | null | undefined;
} | null;

export type AssignmentDetailSubmissionRouterProps = {
  assignment: RouterAssignment;
  submission: RouterSubmission;
  hasFeedback: boolean;
  isTeacherTry: boolean;
  isRTL: boolean;
  resolvedStudentFacingTask: string;
  isStudentTaskLoading: boolean;
  chatInitAllowed: boolean;
  initialGreetingMode: 'default' | 'explain_task';
  storedTaskUnderstandingChoice: 'yes' | 'no' | null;
  chatPriorSubmissionIds: string[];
  nuanceTracking?: NuanceTrackingCallbacks;
  clipboardTracking?: AssignmentClipboardTrackingCallbacks;
  companionChatAnchorRef: RefObject<HTMLDivElement | null>;
  assignmentFlowContinue: AssignmentFlowContinue;
  onNavigateToFlowTarget: (target: FlowStepTarget, opts?: { priorSubmissionId?: string }) => void;
  onGoCurriculum: () => void;
  onAssignmentCompleted: (tone?: AssignmentCompletionTone) => void | Promise<void>;
  onActivityComplete: (args?: { conversationComplete?: boolean }) => void | Promise<void>;
};

export const AssignmentDetailSubmissionRouter = ({
  assignment,
  submission,
  hasFeedback,
  isTeacherTry,
  isRTL,
  resolvedStudentFacingTask,
  isStudentTaskLoading,
  chatInitAllowed,
  initialGreetingMode,
  storedTaskUnderstandingChoice,
  chatPriorSubmissionIds,
  nuanceTracking,
  clipboardTracking,
  companionChatAnchorRef,
  assignmentFlowContinue,
  onNavigateToFlowTarget,
  onGoCurriculum,
  onAssignmentCompleted,
  onActivityComplete,
}: AssignmentDetailSubmissionRouterProps) => {
  const { t } = useTranslation();
  const isCompleted = submission.status === 'completed';

  const flowContinueRow =
    assignmentFlowContinue &&
    assignment.syllabus_section_id &&
    submission.status === 'completed' ? (
      <div className="flex flex-wrap justify-center gap-2 pt-4" dir={isRTL ? 'rtl' : 'ltr'}>
        {assignmentFlowContinue.nextIn ? (
          <Button
            type="button"
            variant="outline"
            className="gap-1 bg-background"
            onClick={() => {
              const nextIn = assignmentFlowContinue.nextIn;
              if (!nextIn) return;
              onNavigateToFlowTarget(nextIn, {
                priorSubmissionId: nextIn.kind === 'assignment' ? submission.id : undefined,
              });
            }}
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
            onClick={() => {
              const firstNext = assignmentFlowContinue.firstNext;
              if (!firstNext) return;
              onNavigateToFlowTarget(firstNext, {
                priorSubmissionId: firstNext.kind === 'assignment' ? submission.id : undefined,
              });
            }}
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
            onClick={onGoCurriculum}
          >
            {t('assignmentDetail.openCurriculum')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    ) : null;

  if (isCompleted && submission.awaiting_teacher_feedback_release) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-10 w-10 text-primary mb-4" />
          <p className="text-sm font-medium text-primary">
            {t('assignmentDetail.awaitingTeacherFeedback')}
          </p>
          {flowContinueRow}
        </CardContent>
      </Card>
    );
  }

  const evalStatus = submission.evaluation_status;

  if (isCompleted && evalStatus === EVALUATION_STATUS.FAILED && !hasFeedback) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-10 w-10 text-primary mb-4" />
          <p className="text-sm font-medium text-primary">
            {t('assignmentDetail.aiFeedbackFailed')}
          </p>
          {flowContinueRow}
        </CardContent>
      </Card>
    );
  }

  if (isCompleted && assignment.enable_ai_feedback === false && !hasFeedback) {
    const awaitingKey = `assignmentDetail.${assignment.type}.awaitingReview`;
    const awaitingFallback = t('assignmentDetail.submittedAwaitingReview', {
      defaultValue: 'Your activity has been submitted and is awaiting teacher review.',
    });
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-10 w-10 text-primary mb-4" />
          <p className="text-sm font-medium text-primary">
            {t(awaitingKey, { defaultValue: awaitingFallback })}
          </p>
          {flowContinueRow}
        </CardContent>
      </Card>
    );
  }

  if (
    isCompleted &&
    !hasFeedback &&
    assignment.enable_ai_feedback !== false &&
    !submission.awaiting_teacher_feedback_release
  ) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-2">
          <CheckCircle className="h-10 w-10 text-primary mb-2" />
          <p className="text-sm font-medium text-primary">
            {t('assignmentDetail.success.completed')}
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            {t('assignmentDetail.assessmentInProgress')}
          </p>
          {flowContinueRow}
        </CardContent>
      </Card>
    );
  }

  const wrapAssignmentWorkspace = (content: ReactNode) => (
    <div className="space-y-6">{content}</div>
  );

  const chatPanelProps = {
    assignment,
    submission,
    isTeacherTry,
    isRTL,
    resolvedStudentFacingTask,
    isStudentTaskLoading,
    chatInitAllowed,
    initialGreetingMode,
    storedTaskUnderstandingChoice,
    chatPriorSubmissionIds,
    nuanceTracking,
    clipboardTracking,
  };

  const companionBlock = (
    <AssignmentDetailChatPanel
      {...chatPanelProps}
      variant="companion"
      companionChatAnchorRef={companionChatAnchorRef}
      onComplete={() => {}}
    />
  );

  switch (assignment.type) {
    case 'test':
      return wrapAssignmentWorkspace(
        <>
          <TestTakingPage
            assignmentId={assignment.id}
            assignmentInstructions={assignment.instructions}
            submissionId={submission.id}
            enableAiFeedback={assignment.enable_ai_feedback !== false}
            showAiFeedbackToStudents={assignment.auto_publish_ai_feedback !== false}
            isTeacherTry={isTeacherTry}
            nuanceTracking={nuanceTracking}
            clipboardTracking={clipboardTracking}
            onComplete={onAssignmentCompleted}
          />
          {companionBlock}
        </>
      );
    case 'text_essay':
      return wrapAssignmentWorkspace(
        <>
          <EssaySubmissionPage
            assignmentId={assignment.id}
            submissionId={submission.id}
            assignmentInstructions={assignment.instructions}
            enableAiFeedback={assignment.enable_ai_feedback !== false}
            showAiFeedbackToStudents={assignment.auto_publish_ai_feedback !== false}
            isTeacherTry={isTeacherTry}
            initialText={submission.text_body}
            clipboardTracking={clipboardTracking}
            onComplete={onAssignmentCompleted}
          />
          {companionBlock}
        </>
      );
    case 'project':
      return wrapAssignmentWorkspace(
        <>
          <ProjectSubmissionPage
            assignmentId={assignment.id}
            submissionId={submission.id}
            assignmentInstructions={assignment.instructions}
            enableAiFeedback={assignment.enable_ai_feedback !== false}
            showAiFeedbackToStudents={assignment.auto_publish_ai_feedback !== false}
            isTeacherTry={isTeacherTry}
            onComplete={onAssignmentCompleted}
          />
          {companionBlock}
        </>
      );
    case 'presentation':
      return wrapAssignmentWorkspace(
        <>
          <PresentationSubmissionPage
            assignmentId={assignment.id}
            submissionId={submission.id}
            assignmentInstructions={assignment.instructions}
            enableAiFeedback={assignment.enable_ai_feedback !== false}
            showAiFeedbackToStudents={assignment.auto_publish_ai_feedback !== false}
            isTeacherTry={isTeacherTry}
            onComplete={onAssignmentCompleted}
          />
          {companionBlock}
        </>
      );
    case 'langchain':
      return wrapAssignmentWorkspace(
        <>
          <LangchainBuilderPage
            assignmentId={assignment.id}
            submissionId={submission.id}
            assignmentInstructions={assignment.instructions}
            enableAiFeedback={assignment.enable_ai_feedback !== false}
            showAiFeedbackToStudents={assignment.auto_publish_ai_feedback !== false}
            isTeacherTry={isTeacherTry}
            initialPipelineText={submission.text_body}
            nuanceTracking={nuanceTracking}
            clipboardTracking={clipboardTracking}
            onComplete={onAssignmentCompleted}
          />
          {companionBlock}
        </>
      );
    default:
      return wrapAssignmentWorkspace(
        <AssignmentDetailChatPanel
          {...chatPanelProps}
          variant="primary"
          onComplete={onActivityComplete}
        />
      );
  }
};
