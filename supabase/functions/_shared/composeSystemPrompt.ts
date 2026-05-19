/**
 * Pure composer for the Perleap tutor system prompt.
 *
 * Replaces the older multi-step assembly (DB template + INITIAL_GREETING_INSTRUCTIONS +
 * POST_GREETING_INSTRUCTIONS + OUTPUT_LOCALE_AND_TYPOGRAPHY + manual SESSION_START_INTERNAL +
 * appended COMPLETION_AND_IMAGE_RULES). Builds one structured prompt with:
 *   1. Skeleton (single precedence + four protocols + reference-transcripts rule) from
 *      `perleapChatCompletionRules.ts`.
 *   2. XML-tagged dynamic context blocks (teacher/style, learner, hard skills, materials,
 *      assignment, prior context).
 *
 * Greeting, em-dash typography, and (Begin.) handling are NOT included here - they live in
 * the Edge function (code-injected greeting prefix + post-hoc normalizeAssistantDashes).
 */

import {
  formatTeacherStyle,
  formatStudentPreferences,
  formatHardSkillsContext,
  formatCourseMaterials,
} from './prompts.ts';
import { getPerleapChatSkeleton } from '../shared/perleapChatCompletionRules.ts';

export interface TaskProgressItem {
  /** 1-based index matching the order returned by parseAssignmentTasks. */
  index: number;
  text: string;
  done: boolean;
}

export interface ComposeSystemPromptInput {
  language: string;
  isInitialGreeting: boolean;
  teacherName: string;
  teacherProfile: unknown;
  studentProfile: unknown;
  assignmentDetails: unknown;
  classroomResources: unknown;
  moduleActivityContext?: string;
  /** Wrapped, trust-isolated assignment instructions (already passed through wrapTrustedAssignmentInstructionsBlock). */
  assignmentInstructionsBlock: string;
  /**
   * Raw assignment tutor text (pre-wrap) used as the relevance reference for the
   * classroom-materials overlap gate. Optional - when omitted, the gate is a no-op.
   */
  assignmentTutorText?: string;
  /** Combined, sanitized prior-unit excerpt (already merged + capped by perleap-chat). Empty string if none. */
  priorContextExcerpt?: string;
  /**
   * Distilled unit memory from earlier assignments in this syllabus section.
   * When non-empty, emitted as <unit_memory> above <task_progress>.
   */
  unitMemoryExcerpt?: string;
  /**
   * Distilled course memory from earlier units in this classroom (cross-unit recall).
   * When non-empty, emitted as <course_memory> after <unit_memory>.
   */
  courseMemoryExcerpt?: string;
  /**
   * Optional server-tracked task progress. When provided and non-empty, emitted as a
   * <task_progress> block above <assignment> and steers TUTOR_TURN_PROTOCOL toward the first
   * INCOMPLETE item. Omit when parseAssignmentTasks returns 0 - the prompt degrades gracefully.
   */
  taskProgress?: TaskProgressItem[];
}

/** Wrap a value in an XML-style tag for the model to anchor on. Empty values are still emitted as <tag/> sentinels so the model never sees a stale section. */
function tag(name: string, value: string): string {
  const v = value.trim();
  if (!v) return `<${name}/>`;
  return `<${name}>\n${v}\n</${name}>`;
}

/**
 * Format <task_progress> body. Returns `''` (caller skips the tag entirely) when no items,
 * so the model isn't asked to track tasks the server couldn't parse.
 */
function formatTaskProgressBody(items: TaskProgressItem[] | undefined): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .map((t) => `${t.index}. ${t.text} - ${t.done ? 'COMPLETE' : 'INCOMPLETE'}`)
    .join('\n');
}

/** Build the structured tutor system prompt. */
export async function composeSystemPrompt(input: ComposeSystemPromptInput): Promise<string> {
  const {
    language,
    teacherProfile,
    studentProfile,
    assignmentDetails,
    classroomResources,
    moduleActivityContext,
    assignmentInstructionsBlock,
    assignmentTutorText,
    priorContextExcerpt,
    unitMemoryExcerpt,
    courseMemoryExcerpt,
    taskProgress,
  } = input;

  const skeleton = getPerleapChatSkeleton(language);

  const teacherStyle = formatTeacherStyle(teacherProfile);
  const learnerPrefs = formatStudentPreferences(studentProfile);
  const hardSkills = formatHardSkillsContext(assignmentDetails);
  const courseMaterials = await formatCourseMaterials(
    assignmentDetails,
    classroomResources,
    moduleActivityContext,
    assignmentTutorText,
  );
  const taskProgressBody = formatTaskProgressBody(taskProgress);

  const sections = [
    skeleton,
    tag('teacher_style', teacherStyle),
    tag('learner_preferences', learnerPrefs),
    tag('task_and_hard_skills', hardSkills),
    tag('course_materials', courseMaterials),
    unitMemoryExcerpt?.trim() ? tag('unit_memory', unitMemoryExcerpt) : '',
    courseMemoryExcerpt?.trim() ? tag('course_memory', courseMemoryExcerpt) : '',
    taskProgressBody ? tag('task_progress', taskProgressBody) : '',
    tag('assignment', assignmentInstructionsBlock),
    tag('prior_context', priorContextExcerpt ?? ''),
  ].filter(Boolean);

  return sections.join('\n\n').trim();
}
