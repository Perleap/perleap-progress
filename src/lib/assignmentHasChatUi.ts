/** Assignment types that render AssignmentChatInterface (primary or companion). */
export function assignmentHasChatUi(type: string | undefined | null): boolean {
  return type !== 'test';
}
