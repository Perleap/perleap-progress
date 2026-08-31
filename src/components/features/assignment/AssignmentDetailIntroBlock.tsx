/* eslint-disable react-refresh/only-export-components -- co-located helpers/variants */
import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  type RefObject,
  type ComponentProps,
} from 'react';
import type { DbAssignmentType } from '@/types/models';
import { AssignmentTypeIntroDialog } from '@/components/features/assignment/AssignmentTypeIntroDialog';
import { SUBMISSION_STATUS } from '@/config/constants';
import { useAssignmentConversationHasMessages } from '@/hooks/queries';
import { isChatLikeAssignmentType } from '@/lib/assignmentChatLike';
import {
  getSeenAssignmentTypes,
  markAssignmentTypeIntroSeen,
} from '@/lib/assignmentTypeIntroStorage';
import { getTaskUnderstandingChoice, markTaskUnderstanding } from '@/lib/taskUnderstandingStorage';

type IntroAssignment = {
  type: string;
  title: string;
  show_task_understanding_prompt?: boolean | null;
  student_facing_task?: string | null;
};

type IntroSubmission = {
  id: string;
  status: string;
};

export type UseAssignmentDetailIntroOptions = {
  isTeacherTry: boolean;
  userId?: string;
  assignment: IntroAssignment | null | undefined;
  submission: IntroSubmission | null | undefined;
  hasFeedback: boolean;
  isStudentTaskLoading: boolean;
  resolvedStudentFacingTask: string;
  clipboardTracking?: ComponentProps<typeof AssignmentTypeIntroDialog>['clipboardTracking'];
  companionChatAnchorRef: RefObject<HTMLDivElement | null>;
};

export function useAssignmentDetailIntro({
  isTeacherTry,
  userId,
  assignment,
  submission,
  hasFeedback,
  isStudentTaskLoading,
  resolvedStudentFacingTask,
  clipboardTracking,
  companionChatAnchorRef,
}: UseAssignmentDetailIntroOptions) {
  const [introWizardOpen, setIntroWizardOpen] = useState(false);
  const [assignmentIntroStorageTick, setAssignmentIntroStorageTick] = useState(0);
  const [taskUnderstandingStorageTick, setTaskUnderstandingStorageTick] = useState(0);
  const [companionScrollTick, setCompanionScrollTick] = useState(0);

  const seenAssignmentIntroTypes = useMemo(() => {
    void assignmentIntroStorageTick;
    return userId ? getSeenAssignmentTypes(userId) : new Set<DbAssignmentType>();
  }, [userId, assignmentIntroStorageTick]);

  const shouldShowAssignmentTypeIntro = Boolean(
    !isTeacherTry &&
    userId &&
    assignment &&
    submission &&
    !hasFeedback &&
    submission.status === SUBMISSION_STATUS.IN_PROGRESS &&
    !seenAssignmentIntroTypes.has(assignment.type as DbAssignmentType)
  );

  const storedTaskUnderstandingChoice = useMemo(() => {
    void taskUnderstandingStorageTick;
    if (!userId || !submission?.id) return null;
    return getTaskUnderstandingChoice(userId, submission.id);
  }, [userId, submission?.id, taskUnderstandingStorageTick]);

  const { data: conversationHasMessages, isSuccess: conversationQueryReady } =
    useAssignmentConversationHasMessages(submission?.id, !isTeacherTry);

  const taskUnderstandingEligible = Boolean(
    !isTeacherTry &&
    userId &&
    assignment &&
    submission &&
    !hasFeedback &&
    submission.status === SUBMISSION_STATUS.IN_PROGRESS &&
    storedTaskUnderstandingChoice === null &&
    conversationQueryReady &&
    conversationHasMessages === false
  );

  const promptEnabled = assignment?.show_task_understanding_prompt !== false;
  const shouldShowIntroWizard = promptEnabled && taskUnderstandingEligible && !isStudentTaskLoading;

  useEffect(() => {
    if (shouldShowIntroWizard) {
      setIntroWizardOpen(true);
    } else {
      setIntroWizardOpen(false);
    }
  }, [shouldShowIntroWizard, assignment?.type, submission?.id]);

  const handleTypeStepComplete = useCallback(() => {
    const eligible =
      userId &&
      assignment &&
      !isTeacherTry &&
      submission?.status === SUBMISSION_STATUS.IN_PROGRESS &&
      !hasFeedback &&
      !seenAssignmentIntroTypes.has(assignment.type as DbAssignmentType);
    if (eligible) {
      markAssignmentTypeIntroSeen(userId, assignment.type as DbAssignmentType);
      setAssignmentIntroStorageTick((n) => n + 1);
    }
  }, [userId, assignment, isTeacherTry, submission?.status, hasFeedback, seenAssignmentIntroTypes]);

  const handleTaskConfirm = useCallback(
    (understood: boolean) => {
      if (!userId || !submission?.id) return;
      markTaskUnderstanding(userId, submission.id, understood ? 'yes' : 'no');
      setTaskUnderstandingStorageTick((n) => n + 1);
      if (!understood && assignment && !isChatLikeAssignmentType(assignment.type)) {
        setCompanionScrollTick((n) => n + 1);
      }
    },
    [userId, submission?.id, assignment]
  );

  const chatInitAllowed = Boolean(
    isTeacherTry ||
    !submission ||
    hasFeedback ||
    submission.status !== SUBMISSION_STATUS.IN_PROGRESS ||
    assignment?.show_task_understanding_prompt === false ||
    storedTaskUnderstandingChoice !== null ||
    (conversationQueryReady && conversationHasMessages === true)
  );

  const initialGreetingMode: 'default' | 'explain_task' =
    storedTaskUnderstandingChoice === 'no' ? 'explain_task' : 'default';

  useEffect(() => {
    if (!assignment || isChatLikeAssignmentType(assignment.type)) return;
    if (storedTaskUnderstandingChoice !== 'no') return;
    const frameId = requestAnimationFrame(() => {
      companionChatAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frameId);
  }, [
    assignment,
    assignment?.type,
    storedTaskUnderstandingChoice,
    companionScrollTick,
    companionChatAnchorRef,
  ]);

  return {
    introWizardOpen,
    setIntroWizardOpen,
    shouldShowAssignmentTypeIntro,
    handleTypeStepComplete,
    handleTaskConfirm,
    chatInitAllowed,
    initialGreetingMode,
    storedTaskUnderstandingChoice,
    introClipboardTracking:
      submission && !hasFeedback && !isTeacherTry ? clipboardTracking : undefined,
    studentFacingTaskForIntro: resolvedStudentFacingTask || assignment?.student_facing_task,
  };
}

export type AssignmentDetailIntroBlockProps = {
  assignment: IntroAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skipTypeStep: boolean;
  studentFacingTask?: string | null;
  taskLoading: boolean;
  onTypeStepComplete: () => void;
  onTaskConfirm: (understood: boolean) => void;
  clipboardTracking?: ComponentProps<typeof AssignmentTypeIntroDialog>['clipboardTracking'];
};

export const AssignmentDetailIntroBlock = ({
  assignment,
  open,
  onOpenChange,
  skipTypeStep,
  studentFacingTask,
  taskLoading,
  onTypeStepComplete,
  onTaskConfirm,
  clipboardTracking,
}: AssignmentDetailIntroBlockProps) => {
  return (
    <AssignmentTypeIntroDialog
      open={open}
      onOpenChange={onOpenChange}
      assignmentType={assignment.type as DbAssignmentType}
      assignmentTitle={assignment.title}
      skipTypeStep={skipTypeStep}
      studentFacingTask={studentFacingTask}
      taskLoading={taskLoading}
      onTypeStepComplete={onTypeStepComplete}
      onTaskConfirm={onTaskConfirm}
      clipboardTracking={clipboardTracking}
    />
  );
};
