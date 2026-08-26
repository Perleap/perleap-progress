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
  getPromptTemplate,
} from './prompts.ts';
import { getPerleapChatSkeleton } from '../shared/perleapChatCompletionRules.ts';

/** Merged explain-task rules when DB template is unavailable (sync with migration). */
const EXPLAIN_TASK_RULES_FALLBACK_EN = `TASK_EXPLANATION (this turn only)
- The student already said they do NOT understand the assignment. Do NOT ask "Do you understand?" or similar comprehension quizzes.
- In 2-4 short sentences, explain the overall goal AND briefly preview each task using the actual numbers and operation words from <assignment> (do not say "combining"; say "add"; do not say "very small numbers"; name them, e.g. "1 + 1, 1 x 1, 1 - 1").
- Use plain wording the student would use; do not paraphrase the operations away.
- End the message by asking the first task from <assignment> directly (e.g. "What is 1 + 1?"). Do NOT add a "ready to start" transition.
- Always put a single space between words; never glue words together. Bad: "thesame", "moreitem", "threearithmetic". Good: "the same", "more item", "three arithmetic".
- At most 4 sentences total, plain prose, no bullet lists.`;

const EXPLAIN_TASK_RULES_FALLBACK_HE = `TASK_EXPLANATION (תור זה בלבד)
- התלמיד/ה כבר אמר/ה שעדיין לא הבין/ה את המטלה. אל תשאלו "הבנת?" או בדיקות הבנה דומות.
- ב-2-4 משפטים קצרים, הסבירו את המטרה הכללית וכן תנו תצוגה מקדימה קצרה של כל משימה באמצעות המספרים והפעולות המדויקות מ-<assignment> (אל תגידו "צירוף"; אמרו "חיבור"; אל תגידו "מספרים קטנים מאוד"; ציינו אותם, למשל "1 + 1, 1 × 1, 1 - 1").
- השתמשו בשפה יומיומית שהתלמיד/ה ישתמש/תשתמש בה; אל תפרשו מחדש את הפעולות.
- סיימו את ההודעה בשאלה של המשימה הראשונה מ-<assignment> ישירות (למשל "כמה זה 1 + 1?"). אל תוסיפו מעבר של "ספרו לי כשאתם מוכנים".
- שמרו תמיד על רווח אחד בין מילים; אל תדביקו מילים. רע: "thesame", "moreitem", "threearithmetic". טוב: "the same", "more item", "three arithmetic".
- עד 4 משפטים בסך הכל, פרוזה פשוטה, בלי רשימות.`;

async function loadExplainTaskRules(language: string): Promise<string> {
  const lang = (language ?? 'en').toLowerCase() === 'he' ? 'he' : 'en';
  try {
    return (await getPromptTemplate('chat_task_explanation_instruction', lang)).trim();
  } catch {
    return lang === 'he' ? EXPLAIN_TASK_RULES_FALLBACK_HE : EXPLAIN_TASK_RULES_FALLBACK_EN;
  }
}

export async function explainTaskAppend(language: string): Promise<string> {
  return loadExplainTaskRules(language);
}

/** Post-explain tutoring rules when DB template is unavailable (sync with migration). */
export const POST_EXPLAIN_TUTOR_FALLBACK_EN = `POST_EXPLAIN_TUTOR (overrides scaffolding in TUTOR_TURN_PROTOCOL for this submission)
- The student already received a plain-language overview of the whole assignment on the first message.
- Do NOT re-teach each sub-task with analogies or step-by-step lessons before asking (no "1+1 means one finger plus another" unless they ask).
- For each turn: target the FIRST INCOMPLETE task in <task_progress>; ask that task directly in the final sentence.
- If the answer is correct: brief acknowledgment (one short sentence), then ask the next INCOMPLETE task.
- If the answer is wrong: one short hint only, then re-ask the SAME task (no lecture).
- If they ask for help or say they don't understand a specific part: explain only that part briefly, then re-ask.
- Always put a single space between words; never glue words together. Bad: "thesame", "moreitem", "threearithmetic". Good: "the same", "more item", "three arithmetic".
- Still at most 3 sentences, plain prose, no lists; still append <<<PROGRESS:[...]>>>; still use COMPLETION_PROTOCOL when all tasks done.`;

export const POST_EXPLAIN_TUTOR_FALLBACK_HE = `POST_EXPLAIN_TUTOR (גובר על פיגום ב-TUTOR_TURN_PROTOCOL להגשה זו)
- התלמיד/ה כבר קיבל/ה סקירה בשפה פשוטה של כל המטלה בהודעה הראשונה.
- אל תלמדו מחדש כל תת-משימה באנלוגיות או שיעור שלב-אחר-שלב לפני השאלה (לא "1+1 זה אצבע ועוד אצבע" אלא אם מבקשים).
- בכל תור: כוונו למשימה הראשונה שמסומנת INCOMPLETE ב-<task_progress>; שאלו אותה ישירות במשפט האחרון.
- תשובה נכונה: אישור קצר (משפט אחד), ואז השאלה על המשימה הבאה ש-INCOMPLETE.
- תשובה שגויה: רמז קצר אחד בלבד, ואז שאלו שוב את אותה משימה (בלי הרצאה).
- אם מבקשים עזרה או שלא מבינים חלק מסוים: הסבירו רק את החלק הזה בקצרה, ואז שאלו שוב.
- שמרו תמיד על רווח אחד בין מילים; אל תדביקו מילים. רע: "thesame", "moreitem", "threearithmetic". טוב: "the same", "more item", "three arithmetic".
- עדיין עד 3 משפטים, פרוזה פשוטה, בלי רשימות; עדיין <<<PROGRESS:[...]>>>; עדיין COMPLETION_PROTOCOL כשהכל הושלם.`;

export async function postExplainTutorAppend(language: string): Promise<string> {
  const lang = (language ?? 'en').toLowerCase() === 'he' ? 'he' : 'en';
  try {
    return (await getPromptTemplate('chat_post_explain_tutor_instruction', lang)).trim();
  } catch {
    return lang === 'he' ? POST_EXPLAIN_TUTOR_FALLBACK_HE : POST_EXPLAIN_TUTOR_FALLBACK_EN;
  }
}

const COMPANION_EXPLAIN_TASK_EN = `COMPANION_EXPLAIN_TASK (overrides TASK_EXPLANATION for this turn)
- This chat is a help panel only. The student completes and submits the assignment in the UI section ABOVE this chat.
- The student said they do NOT understand the assignment yet.
- In at most 2 short sentences, explain what they must do using <assignment>, and point them to the section above on the page.
- For test/quiz assignments: all questions are already displayed above — do NOT ask the student to paste, share, or read out quiz questions.
- Do NOT start tutoring or ask them to answer sub-tasks in chat; end with one brief check-for-understanding question about the process (e.g. "Does that make sense?").`;

const COMPANION_EXPLAIN_TASK_HE = `COMPANION_EXPLAIN_TASK (גובר על TASK_EXPLANATION לתור זה)
- הצ'אט הזה הוא פאנל עזרה בלבד. התלמיד/ה משלים/ה ומגיש/ה את המטלה באזור שמעל הצ'אט.
- התלמיד/ה ציין/ה שעדיין לא הבין/ה את המטלה.
- במשפטיים קצרים לכל היותר, הסבירו מה נדרש לפי <assignment>, והפנו לאזור שמעל בעמוד.
- במבחן/חידון: כל השאלות כבר מוצגות למעלה — אל תבקשו להדביק, לשתף או לקרוא שאלות.
- אל תתחילו הוראה או שאלות תשובה בצ'אט; סיימו בשאלת הבנה קצרה אחת על התהליך (למשל "זה ברור?").`;

const COMPANION_POST_EXPLAIN_EN = `COMPANION_HELP (overrides POST_EXPLAIN_TUTOR for this chat)
- This is a help panel alongside the main assignment UI above — not where the student submits work.
- Answer questions about the assignment process or specific content when asked; do NOT walk through each sub-task in chat.
- Do NOT ask the student to paste or share content already visible above (especially test/quiz questions).
- Keep replies short (at most 3 sentences). Do not append <<<PROGRESS:[...]>>> or end the activity from this chat.`;

const COMPANION_POST_EXPLAIN_HE = `COMPANION_HELP (גובר על POST_EXPLAIN_TUTOR לצ'אט זה)
- זהו פאנל עזרה לצד ממשק המטלה הראשי למעלה — לא מקום ההגשה.
- ענו על שאלות על התהליך או תוכן ספציפי כשמבקשים; אל תעברו משימה-משימה בצ'אט.
- אל תבקשו להדביק או לשתף תוכן שכבר גלוי למעלה (במיוחד שאלות מבחן/חידון).
- שמרו על תשובות קצרות (עד 3 משפטים). אל תוסיפו <<<PROGRESS:[...]>>> ואל תסיימו את הפעילות מצ'אט זה.`;

export function companionExplainTaskAppend(language: string): string {
  return (language ?? 'en').toLowerCase() === 'he' ? COMPANION_EXPLAIN_TASK_HE : COMPANION_EXPLAIN_TASK_EN;
}

export function companionPostExplainAppend(language: string): string {
  return (language ?? 'en').toLowerCase() === 'he' ? COMPANION_POST_EXPLAIN_HE : COMPANION_POST_EXPLAIN_EN;
}

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
  const unitMemory = unitMemoryExcerpt?.trim() ?? '';
  const courseMemory = courseMemoryExcerpt?.trim() ?? '';

  const sections = [
    skeleton,
    tag('teacher_style', teacherStyle),
    tag('learner_preferences', learnerPrefs),
    tag('task_and_hard_skills', hardSkills),
    tag('course_materials', courseMaterials),
    unitMemory ? tag('unit_memory', unitMemory) : '',
    courseMemory ? tag('course_memory', courseMemory) : '',
    taskProgressBody ? tag('task_progress', taskProgressBody) : '',
    tag('assignment', assignmentInstructionsBlock),
    tag('prior_context', priorContextExcerpt ?? ''),
  ].filter(Boolean);

  return sections.join('\n\n').trim();
}
