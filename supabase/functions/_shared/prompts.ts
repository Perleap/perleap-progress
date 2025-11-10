/**
 * Shared Prompt Utilities
 * Functions for fetching and rendering AI prompts from the database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

// In-memory cache for prompts (edge function lifecycle)
const promptCache = new Map<string, { template: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch a prompt template from the database by key with caching
 */
export async function getPromptTemplate(promptKey: string): Promise<string> {
  // Check cache first
  const cached = promptCache.get(promptKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.template;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('ai_prompts')
    .select('prompt_template')
    .eq('prompt_key', promptKey)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch prompt: ${promptKey}`);
  }

  // Cache the result
  promptCache.set(promptKey, {
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
): Promise<string> {
  const template = await getPromptTemplate(promptKey);
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
): Promise<string> {
  const greetingInstruction = isInitialGreeting
    ? await getPrompt('chat_greeting_instruction', { teacherName })
    : '';

  const afterGreeting = isInitialGreeting
    ? await getPromptTemplate('chat_after_greeting')
    : '';

  return await getPrompt('chat_system', {
    assignmentInstructions,
    greetingInstruction,
    afterGreeting,
  });
}

/**
 * Generate feedback prompt
 */
export async function generateFeedbackPrompt(
  studentName: string,
  teacherName: string,
): Promise<string> {
  return await getPrompt('feedback_generation', {
    studentName,
    teacherName,
  });
}

/**
 * Generate 5D scores prompt
 */
export async function generateScoresPrompt(studentName: string): Promise<string> {
  return await getPrompt('five_d_scores', {
    studentName,
  });
}

/**
 * Generate wellbeing analysis prompt
 */
export async function generateWellbeingAnalysisPrompt(
  studentName: string,
): Promise<string> {
  return await getPrompt('wellbeing_analysis', {
    studentName,
  });
}

/**
 * Get initial greeting message
 */
export async function getInitialGreetingMessage(): Promise<string> {
  return await getPromptTemplate('chat_initial_greeting');
}