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

  // Try to get prompt in requested language
  let { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_template')
    .eq('prompt_key', promptKey)
    .eq('language', language)
    .eq('is_active', true)
    .single();

  // Fallback to English if not found
  if ((error || !data) && language !== 'en') {
    const result = await supabase
      .from('ai_prompts')
      .select('prompt_template')
      .eq('prompt_key', promptKey)
      .eq('language', 'en')
      .eq('is_active', true)
      .single();
    
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
 * Get initial greeting message
 */
export async function getInitialGreetingMessage(language: string = 'en'): Promise<string> {
  return await getPromptTemplate('chat_initial_greeting', language);
}