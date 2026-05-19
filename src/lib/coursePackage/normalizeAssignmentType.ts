import type { DbAssignmentType } from '@/types/models';

const VALID_ASSIGNMENT_TYPES = new Set<DbAssignmentType>([
  'text_essay',
  'quiz_mcq',
  'creative_task',
  'discussion_prompt',
  'multimedia',
  'project',
  'questions',
  'test',
  'presentation',
  'langchain',
  'chatbot',
]);

/** GPT/legacy exports may use labels that are not Postgres enum values (e.g. "submission"). */
const ASSIGNMENT_TYPE_ALIASES: Record<string, DbAssignmentType> = {
  submission: 'chatbot',
  essay: 'text_essay',
  chat: 'chatbot',
};

const DEFAULT_IMPORT_ASSIGNMENT_TYPE: DbAssignmentType = 'chatbot';

export function normalizeAssignmentTypeForImport(raw: unknown): DbAssignmentType {
  const t = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!t) return DEFAULT_IMPORT_ASSIGNMENT_TYPE;

  if (VALID_ASSIGNMENT_TYPES.has(t as DbAssignmentType)) {
    return t as DbAssignmentType;
  }

  const aliased = ASSIGNMENT_TYPE_ALIASES[t];
  if (aliased) {
    return aliased;
  }

  return DEFAULT_IMPORT_ASSIGNMENT_TYPE;
}
