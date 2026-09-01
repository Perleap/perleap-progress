import type { AssignmentClipboardTrackingCallbacks } from '@/hooks/useAssignmentClipboardTracking';
import type { NuanceTrackingCallbacks } from '@/hooks/useNuanceTracking';
import type { DbAssignmentType } from '@/types/models';

export type AssignmentChatCompletePayload = {
  /** True when the green "conversation complete" state was true at submit. */
  conversationComplete: boolean;
};

export type AssignmentChatInterfaceProps = {
  assignmentId: string;
  assignmentTitle: string;
  teacherName: string;
  assignmentInstructions: string;
  submissionId: string;
  /** Student `user_id` for this submission (required so admins opening the page still chat as the learner). */
  studentUserId: string;
  /** Optional; ordered prior submission ids (whole-unit chain); server validates and merges excerpts. */
  priorSubmissionIdsForContext?: string[];
  onComplete: (payload: AssignmentChatCompletePayload) => void | Promise<void>;
  nuanceTracking?: NuanceTrackingCallbacks;
  clipboardTracking?: AssignmentClipboardTrackingCallbacks;
  /** primary = chat completes the assignment; companion = Q&A alongside another task UI */
  variant?: 'primary' | 'companion';
  assignmentType: DbAssignmentType;
  studentFacingTask?: string | null;
  taskLoading?: boolean;
  /** When false, the first AI greeting is deferred until this becomes true. */
  chatInitAllowed?: boolean;
  initialGreetingMode?: 'default' | 'explain_task';
  postExplainTutoring?: boolean;
};

export const CHAT_INPUT_MAX_HEIGHT_PX = 200;
export const COMPANION_CHAT_OPEN_LS = 'perleap_assignment_companion_chat_open';
