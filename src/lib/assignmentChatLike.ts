/** Aligns with `isChatLikeAssignment` in SubmissionTabs (chatbot / questions / non–worksheet flows). */
const NON_CHAT_ASSIGNMENT_TYPES = ['test', 'project', 'presentation', 'langchain', 'text_essay'] as const;

export function isChatLikeAssignmentType(type: string | undefined | null): boolean {
  if (!type) return false;
  return !NON_CHAT_ASSIGNMENT_TYPES.includes(type as (typeof NON_CHAT_ASSIGNMENT_TYPES)[number]);
}
