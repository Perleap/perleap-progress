import { type Ref, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentClipboardTrackingCallbacks } from '@/hooks/useAssignmentClipboardTracking';
import type { NuanceTrackingCallbacks } from '@/hooks/useNuanceTracking';
import type { DbAssignmentType } from '@/types/models';
import { AssignmentChatInterface } from '@/components/AssignmentChatInterface';

type ChatAssignment = {
  id: string;
  type: string;
  title: string;
  instructions: string;
  student_facing_task?: string | null;
  classrooms: {
    teacher_profiles?: { full_name?: string | null } | null;
  };
};

type ChatSubmission = {
  id: string;
  student_id: string;
};

export type AssignmentDetailChatPanelProps = {
  variant: 'primary' | 'companion';
  assignment: ChatAssignment;
  submission: ChatSubmission;
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
  companionChatAnchorRef?: RefObject<HTMLDivElement | null>;
  onComplete: (args?: { conversationComplete?: boolean }) => void | Promise<void>;
};

export const AssignmentDetailChatPanel = ({
  variant,
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
  companionChatAnchorRef,
  onComplete,
}: AssignmentDetailChatPanelProps) => {
  const { t } = useTranslation();

  const chat = (
    <AssignmentChatInterface
      assignmentId={assignment.id}
      assignmentTitle={assignment.title}
      teacherName={assignment.classrooms.teacher_profiles?.full_name || 'Teacher'}
      assignmentInstructions={assignment.instructions}
      submissionId={submission.id}
      studentUserId={submission.student_id}
      priorSubmissionIdsForContext={isTeacherTry ? undefined : chatPriorSubmissionIds}
      onComplete={onComplete}
      nuanceTracking={nuanceTracking}
      clipboardTracking={clipboardTracking}
      variant={variant}
      assignmentType={assignment.type as DbAssignmentType}
      studentFacingTask={resolvedStudentFacingTask || assignment.student_facing_task}
      taskLoading={isStudentTaskLoading}
      chatInitAllowed={chatInitAllowed}
      initialGreetingMode={initialGreetingMode}
      postExplainTutoring={storedTaskUnderstandingChoice === 'no'}
    />
  );

  if (variant === 'companion') {
    return (
      <div ref={companionChatAnchorRef as Ref<HTMLDivElement> | undefined} className="space-y-2">
        <p className="text-xs text-muted-foreground px-0.5" dir={isRTL ? 'rtl' : 'ltr'}>
          {t('assignmentDetail.contextChatHint')}
        </p>
        {chat}
      </div>
    );
  }

  return chat;
};
