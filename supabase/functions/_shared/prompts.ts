/**
 * Shared Prompt Utilities
 * Functions for fetching and rendering AI prompts from the database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { parseHardSkillsFromDb } from './hardSkillsFormat.ts';
import { MAX_CHAT_MATERIALS_MODULE_CONTEXT_CHARS } from '../shared/perleapPriorContext.ts';
import { getServiceRoleKey } from '../shared/supabase.ts';

// In-memory cache for prompts (edge function lifecycle)
const promptCache = new Map<string, { template: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch a prompt template from the database by key and language with caching
 */
export async function getPromptTemplate(promptKey: string, language: string = 'en'): Promise<string> {
  // Check cache first
  const cacheKey = `${promptKey}_${language}`;
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.template;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = getServiceRoleKey();
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Try to get prompt in requested language (get latest version if multiple exist)
  let { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_template')
    .eq('prompt_key', promptKey)
    .eq('language', language)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fallback to English if not found
  if ((error || !data) && language !== 'en') {
    const result = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('prompt_key', promptKey)
      .eq('language', 'en')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    data = result.data;
    error = result.error;
  }

  if (error || !data) {
    throw new Error(`Failed to fetch prompt: ${promptKey} in language: ${language}`);
  }

  // Cache the result
  promptCache.set(cacheKey, {
    template: data.prompt_template,
    timestamp: Date.now(),
  });

  return data.prompt_template;
}

/**
 * Render a prompt template by replacing variables
 * Variables are in the format {{variableName}}
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string>,
): string {
  let rendered = template;

  // Replace all {{variableName}} with actual values
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    rendered = rendered.replace(regex, value);
  }

  return rendered;
}

/**
 * Fetch and render a prompt in one call
 */
export async function getPrompt(
  promptKey: string,
  variables: Record<string, string> = {},
  language: string = 'en',
): Promise<string> {
  const template = await getPromptTemplate(promptKey, language);
  return renderPrompt(template, variables);
}

/**
 * Generate unified feedback, scores, and explanations prompt
 */
export async function generateUnifiedFeedbackPrompt(
  studentName: string,
  teacherName: string,
  assignmentInstructions: string,
  hardSkillsList: string[] = [],
  hardSkillDomain: string = '',
  language: string = 'en'
): Promise<string> {
  const hardSkillsSection = hardSkillsList.length > 0 
    ? `\n\nHard Skills to Assess in the "${hardSkillDomain}" domain:\n- ${hardSkillsList.join('\n- ')}\n\nFor each hard skill, provide a current_level_percent (0-100), proficiency_description, and actionable_challenge.`
    : '';

  return await getPrompt('unified_feedback_generation', {
    studentName,
    teacherName,
    assignmentInstructions,
    hardSkillsSection
  }, language);
}

/**
 * Generate chat system prompt
 * Fetches and combines the chat_system prompt with dynamic greeting instructions
 */
export async function generateChatSystemPrompt(
  assignmentInstructions: string,
  teacherName: string,
  isInitialGreeting: boolean,
  language: string = 'en',
): Promise<string> {
  const greetingInstruction = isInitialGreeting
    ? await getPrompt('chat_greeting_instruction', { teacherName }, language)
    : '';

  const afterGreeting = isInitialGreeting
    ? await getPromptTemplate('chat_after_greeting', language)
    : '';

  return await getPrompt('chat_system', {
    assignmentInstructions,
    greetingInstruction,
    afterGreeting,
  }, language);
}

/**
 * Generate feedback prompt
 */
export async function generateFeedbackPrompt(
  studentName: string,
  teacherName: string,
  language: string = 'en',
): Promise<string> {
  return await getPrompt('feedback_generation', {
    studentName,
    teacherName,
  }, language);
}

/**
 * Generate 5D scores prompt
 */
export async function generateScoresPrompt(studentName: string, language: string = 'en'): Promise<string> {
  return await getPrompt('five_d_scores', {
    studentName,
  }, language);
}

/**
 * Generate wellbeing analysis prompt
 */
export async function generateWellbeingAnalysisPrompt(
  studentName: string,
  language: string = 'en',
): Promise<string> {
  return await getPrompt('wellbeing_analysis', {
    studentName,
  }, language);
}

/**
 * Generate score explanations prompt
 */
export async function generateScoreExplanationsPrompt(
  conversationText: string,
  scoresContext: string,
  language: string = 'en',
): Promise<string> {
  return await getPrompt('score_explanations', {
    conversationText,
    scoresContext,
  }, language);
}

/**
 * Get initial greeting message
 */
export async function getInitialGreetingMessage(language: string = 'en'): Promise<string> {
  return await getPromptTemplate('chat_initial_greeting', language);
}

/**
 * Replace em/en dashes with a spaced hyphen so the model doesn't pick up em-dash style from
 * the teacher's profile examples. Mirrors the output-side `normalizeAssistantDashes` semantics
 * but kept local so this `_shared` module doesn't reach into `perleap-chat/`.
 */
function stripEmDashes(s: string): string {
  if (!s) return s;
  return s.replace(/\s*[—–]\s*/g, ' - ');
}

/**
 * Format teacher profile data into a readable context string.
 * `compact` omits long examples (used by composeExplainTaskSystemPrompt).
 */
export function formatTeacherStyle(
  teacherProfile: any,
  options?: { compact?: boolean },
): string {
  if (!teacherProfile) {
    return 'No specific teaching style documented. Use a supportive, encouraging approach.';
  }

  const parts = [];

  if (teacherProfile.teaching_goals) {
    parts.push(`Teaching Goals: ${stripEmDashes(teacherProfile.teaching_goals)}`);
  }

  if (teacherProfile.style_notes) {
    parts.push(`Teaching Style: ${stripEmDashes(teacherProfile.style_notes)}`);
  }

  if (!options?.compact) {
    if (teacherProfile.teaching_examples) {
      parts.push(`Teaching Examples: ${stripEmDashes(teacherProfile.teaching_examples)}`);
    }

    if (teacherProfile.sample_explanation) {
      parts.push(`Explanation Style: ${stripEmDashes(teacherProfile.sample_explanation)}`);
    }

    if (teacherProfile.encouragement_phrases) {
      parts.push(`Encouragement Phrases to Use: ${stripEmDashes(teacherProfile.encouragement_phrases)}`);
    }

    if (teacherProfile.phrases_to_avoid) {
      parts.push(`Phrases to Avoid: ${stripEmDashes(teacherProfile.phrases_to_avoid)}`);
    }

    if (teacherProfile.mistake_response) {
      parts.push(`How to Respond to Mistakes: ${stripEmDashes(teacherProfile.mistake_response)}`);
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Use a supportive, encouraging teaching approach.';
}

/**
 * Format student profile data into a readable context string
 */
export function formatStudentPreferences(studentProfile: any): string {
  if (!studentProfile) {
    return 'No specific learning preferences documented. Adapt to the student\'s responses.';
  }

  const parts = [];
  
  if (studentProfile.learning_methods) {
    parts.push(`Preferred Learning Methods: ${studentProfile.learning_methods}`);
  }
  
  if (studentProfile.solo_vs_group) {
    parts.push(`Learning Environment: ${studentProfile.solo_vs_group}`);
  }
  
  if (studentProfile.motivation_factors) {
    parts.push(`Motivation Factors: ${studentProfile.motivation_factors}`);
  }
  
  if (studentProfile.help_preferences) {
    parts.push(`Help Preferences: ${studentProfile.help_preferences}`);
  }
  
  if (studentProfile.teacher_preferences) {
    parts.push(`Teacher Interaction Preferences: ${studentProfile.teacher_preferences}`);
  }
  
  if (studentProfile.feedback_preferences) {
    parts.push(`Feedback Preferences: ${studentProfile.feedback_preferences}`);
  }
  
  if (studentProfile.learning_goal) {
    parts.push(`Learning Goals: ${studentProfile.learning_goal}`);
  }
  
  if (studentProfile.special_needs) {
    parts.push(`Special Considerations: ${studentProfile.special_needs}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Adapt to the student\'s responses and learning style.';
}

/**
 * Format hard skills context
 */
export function formatHardSkillsContext(assignmentDetails: any): string {
  if (!assignmentDetails) {
    return 'No specific hard skills defined for this assignment.';
  }

  let parsedList: unknown = assignmentDetails.hard_skills;
  if (typeof parsedList === 'string') {
    try {
      parsedList = JSON.parse(parsedList);
    } catch {
      parsedList = [];
    }
  }
  const pairs = parseHardSkillsFromDb(parsedList, assignmentDetails.hard_skill_domain);

  const parts: string[] = [];
  if (assignmentDetails.hard_skill_domain?.trim()) {
    parts.push(`Domain/Area: ${assignmentDetails.hard_skill_domain}`);
  }

  if (pairs.length > 0) {
    const bullets = pairs.map((p) =>
      p.domain.trim() ? `- ${p.domain} — ${p.skill}` : `- ${p.skill}`,
    );
    parts.push(`Skills to Develop:\n${bullets.join('\n')}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Focus on helping the student understand the assignment material.';
}

function truncateContextBlock(s: string, maxChars: number): string {
  const t = s.trim();
  if (t.length <= maxChars) return t;
  const budget = Math.max(0, maxChars - 30);
  return `${t.slice(0, budget)}\n… [truncated]\n`;
}

/** Prioritize assignment-linked + syllabus module text; generic classroom blurbs get smaller caps. */
const CHAT_MATERIALS_ASSIGNMENT_MAX = 4000;
const CHAT_MATERIALS_MODULE_MAX = 7200;
const CHAT_MATERIALS_CLASSROOM_RESOURCES_MAX = 2400;
const CHAT_MATERIALS_COURSE_OUTLINE_MAX = 2400;

/**
 * Format course materials context.
 *
 * When `assignmentTutorText` is provided AND the env flag
 * `PERLEAP_CHAT_GATE_OFF_TOPIC_MATERIALS` is true (default), the classroom-wide
 * blocks (`Course Resources`, `Course Outline`) are dropped if they share zero
 * keywords with the assignment. Assignment-specific materials and module-linked
 * syllabus activities are always kept - those are scoped to this assignment.
 */
export async function formatCourseMaterials(
  assignmentDetails: any,
  classroomResources: any,
  moduleActivityContext?: string,
  assignmentTutorText?: string,
): Promise<string> {
  const skipClassroomWide =
    Deno.env.get('PERLEAP_CHAT_SKIP_CLASSROOM_RESOURCES') === 'true';
  // Default ON: drop classroom-wide materials when they're clearly off-topic.
  const gateOffTopic =
    (Deno.env.get('PERLEAP_CHAT_GATE_OFF_TOPIC_MATERIALS') ?? 'true') !== 'false';

  let isOffTopic = (text: string): boolean => false;
  if (gateOffTopic && assignmentTutorText && assignmentTutorText.trim().length > 0) {
    const { hasKeywordOverlap, extractKeywordSet } = await import('./topicOverlap.ts');
    const assignmentKeywords = extractKeywordSet(assignmentTutorText);
    if (assignmentKeywords.size > 0) {
      isOffTopic = (text: string) => !hasKeywordOverlap(text, assignmentTutorText);
    }
  }

  const blocks: string[] = [];

  if (assignmentDetails?.materials) {
    try {
      const assignmentMaterials = typeof assignmentDetails.materials === 'string'
        ? JSON.parse(assignmentDetails.materials)
        : assignmentDetails.materials;
      if (Array.isArray(assignmentMaterials) && assignmentMaterials.length > 0) {
        const lines = [`Assignment Materials:`];
        assignmentMaterials.forEach((material: any) => {
          lines.push(`- ${material.name || 'Material'} (${material.type}): ${material.url}`);
        });
        blocks.push(truncateContextBlock(lines.join('\n'), CHAT_MATERIALS_ASSIGNMENT_MAX));
      }
    } catch {
      // Ignore parsing errors
    }
  }

  if (moduleActivityContext?.trim()) {
    blocks.push(
      truncateContextBlock(
        `Linked module activities (syllabus):\n${moduleActivityContext.trim()}`,
        CHAT_MATERIALS_MODULE_MAX,
      ),
    );
  }

  if (!skipClassroomWide && classroomResources?.resources) {
    const text = String(classroomResources.resources).trim();
    if (text && !isOffTopic(text)) {
      blocks.push(
        truncateContextBlock(
          `Course Resources:\n${text}`,
          CHAT_MATERIALS_CLASSROOM_RESOURCES_MAX,
        ),
      );
    }
  }

  if (!skipClassroomWide && classroomResources?.course_outline) {
    const text = String(classroomResources.course_outline).trim();
    if (text && !isOffTopic(text)) {
      blocks.push(
        truncateContextBlock(
          `Course Outline:\n${text}`,
          CHAT_MATERIALS_COURSE_OUTLINE_MAX,
        ),
      );
    }
  }

  const raw = blocks.length > 0
    ? blocks.join('\n\n')
    : 'No additional course materials provided. Use your knowledge to support the student.';

  return truncateContextBlock(raw, MAX_CHAT_MATERIALS_MODULE_CONTEXT_CHARS);
}

/**
 * Generate enhanced chat system prompt with all context elements.
 *
 * Thin delegate for backward compatibility - the actual composition lives in
 * `composeSystemPrompt.ts` (single declarative precedence + XML-tagged context blocks).
 * Callers that need to add a prior-context section pass the merged excerpt in via the
 * new optional `priorContextExcerpt` argument; legacy callers without it still work.
 */
export async function generateEnhancedChatSystemPrompt(
  assignmentInstructions: string,
  teacherName: string,
  teacherProfile: any,
  studentProfile: any,
  assignmentDetails: any,
  classroomResources: any,
  isInitialGreeting: boolean,
  language: string = 'en',
  moduleActivityContext?: string,
  priorContextExcerpt?: string,
  taskProgress?: { index: number; text: string; done: boolean }[],
  assignmentTutorText?: string,
  unitMemoryExcerpt?: string,
  courseMemoryExcerpt?: string,
): Promise<string> {
  const { composeSystemPrompt } = await import('./composeSystemPrompt.ts');
  return composeSystemPrompt({
    language,
    isInitialGreeting,
    teacherName,
    teacherProfile,
    studentProfile,
    assignmentDetails,
    classroomResources,
    moduleActivityContext,
    assignmentInstructionsBlock: assignmentInstructions,
    assignmentTutorText,
    priorContextExcerpt,
    unitMemoryExcerpt,
    courseMemoryExcerpt,
    taskProgress,
  });
}

/**
 * Bilingual block appended to Perleap chat system prompt when carrying over prior assignment context.
 */
export function buildPriorAssignmentContextSection(language: string, excerpt: string): string {
  const text = excerpt.trim();
  if (!text) return '';

  const header =
    language === 'he'
      ? 'הקשר מפעילויות קודמות שאותו תלמיד השלים ביחידה הזו (אותו כיתת קורס ואותו פרק בסילבוס):'
      : 'Context from earlier activities this student completed in this unit (same classroom and syllabus section):';

  const rules =
    language === 'he'
      ? 'בהנחיות המטלה הנוכחית — המשיכו לעקוב אחרי משימות המטלה הנוכחית. אם התלמיד שואל במפורש מה בחר או מה כתב בפעילות קודמת (לרבות בחידון רב־ברירה), ענו מהשורות בקטע למטה; אל תאמרו שאין לכם גישה. אחרי תשובה קצרה על העבר, חזרו בעדינות למטלה הנוכחית אם צריך.'
      : 'For the CURRENT assignment, keep guiding its tasks. If the student explicitly asks what they chose or wrote on an earlier activity (including multiple choice), answer accurately from the excerpt below—do not claim you lack access. After briefly answering, gently return to the current task if needed.';

  return `\n\n---\n${header}\n\n${rules}\n\n${text}\n---\n`;
}