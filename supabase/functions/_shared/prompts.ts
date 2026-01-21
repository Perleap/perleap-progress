/**
 * Shared Prompt Utilities
 * Functions for fetching and rendering AI prompts from the database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

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
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
 * Format teacher profile data into a readable context string
 */
function formatTeacherStyle(teacherProfile: any): string {
  if (!teacherProfile) {
    return 'No specific teaching style documented. Use a supportive, encouraging approach.';
  }

  const parts = [];
  
  if (teacherProfile.teaching_goals) {
    parts.push(`Teaching Goals: ${teacherProfile.teaching_goals}`);
  }
  
  if (teacherProfile.style_notes) {
    parts.push(`Teaching Style: ${teacherProfile.style_notes}`);
  }
  
  if (teacherProfile.teaching_examples) {
    parts.push(`Teaching Examples: ${teacherProfile.teaching_examples}`);
  }
  
  if (teacherProfile.sample_explanation) {
    parts.push(`Explanation Style: ${teacherProfile.sample_explanation}`);
  }
  
  if (teacherProfile.encouragement_phrases) {
    parts.push(`Encouragement Phrases to Use: ${teacherProfile.encouragement_phrases}`);
  }
  
  if (teacherProfile.phrases_to_avoid) {
    parts.push(`Phrases to Avoid: ${teacherProfile.phrases_to_avoid}`);
  }
  
  if (teacherProfile.mistake_response) {
    parts.push(`How to Respond to Mistakes: ${teacherProfile.mistake_response}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Use a supportive, encouraging teaching approach.';
}

/**
 * Format student profile data into a readable context string
 */
function formatStudentPreferences(studentProfile: any): string {
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
function formatHardSkillsContext(assignmentDetails: any): string {
  if (!assignmentDetails) {
    return 'No specific hard skills defined for this assignment.';
  }

  const parts = [];
  
  if (assignmentDetails.hard_skill_domain) {
    parts.push(`Domain/Area: ${assignmentDetails.hard_skill_domain}`);
  }
  
  if (assignmentDetails.hard_skills) {
    try {
      const skills = JSON.parse(assignmentDetails.hard_skills);
      if (Array.isArray(skills) && skills.length > 0) {
        parts.push(`Skills to Develop:\n- ${skills.join('\n- ')}`);
      }
    } catch (e) {
      // If parsing fails, use as-is if it's a string
      if (typeof assignmentDetails.hard_skills === 'string' && assignmentDetails.hard_skills.length > 0) {
        parts.push(`Skills to Develop: ${assignmentDetails.hard_skills}`);
      }
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : 'Focus on helping the student understand the assignment material.';
}

/**
 * Format course materials context
 */
function formatCourseMaterials(assignmentDetails: any, classroomResources: any): string {
  const materials = [];
  
  // Add assignment-specific materials
  if (assignmentDetails?.materials) {
    try {
      // Handle both JSONB (object) and old TEXT (string) formats
      const assignmentMaterials = typeof assignmentDetails.materials === 'string'
        ? JSON.parse(assignmentDetails.materials)
        : assignmentDetails.materials;
      if (Array.isArray(assignmentMaterials) && assignmentMaterials.length > 0) {
        materials.push('Assignment Materials:');
        assignmentMaterials.forEach((material: any) => {
          materials.push(`- ${material.name || 'Material'} (${material.type}): ${material.url}`);
        });
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // Add classroom-level resources
  if (classroomResources?.resources) {
    materials.push('\nCourse Resources:');
    materials.push(classroomResources.resources);
  }
  
  if (classroomResources?.course_outline) {
    materials.push('\nCourse Outline:');
    materials.push(classroomResources.course_outline);
  }

  return materials.length > 0 
    ? materials.join('\n') 
    : 'No additional course materials provided. Use your knowledge to support the student.';
}

/**
 * Generate enhanced chat system prompt with all context elements
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
): Promise<string> {
  const greetingInstruction = isInitialGreeting
    ? await getPrompt('chat_greeting_instruction', { teacherName }, language)
    : '';

  const afterGreeting = isInitialGreeting
    ? await getPromptTemplate('chat_after_greeting', language)
    : '';

  const teacherStyle = formatTeacherStyle(teacherProfile);
  const studentPreferences = formatStudentPreferences(studentProfile);
  const hardSkillsContext = formatHardSkillsContext(assignmentDetails);
  const courseMaterials = formatCourseMaterials(assignmentDetails, classroomResources);

  return await getPrompt('chat_system_enhanced', {
    teacher_style: teacherStyle,
    student_preferences: studentPreferences,
    hard_skills_context: hardSkillsContext,
    course_materials: courseMaterials,
    assignment_instructions: assignmentInstructions,
    greeting_instruction: greetingInstruction,
    after_greeting: afterGreeting,
  }, language);
}