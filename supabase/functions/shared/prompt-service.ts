/**
 * Prompt Service
 * Retrieves and renders prompt templates stored in the database.
 */

import { createSupabaseClient } from './supabase.ts';
import { logError, logWarn } from './logger.ts';

interface PromptCacheEntry {
  content: string;
  expiresAt: number;
}

const PROMPT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const promptCache = new Map<string, PromptCacheEntry>();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizeValue = (value: string | undefined | null) => {
  if (value === undefined || value === null) {
    return '';
  }
  return value.toString();
};

const removeStalePlaceholders = (content: string) =>
  content.replace(/{{\s*[\w.-]+\s*}}/g, '').replace(/\n{3,}/g, '\n\n').trim();

/**
 * Clear cached prompt templates.
 */
export const clearPromptCache = (promptKey?: string) => {
  if (promptKey) {
    promptCache.delete(promptKey);
  } else {
    promptCache.clear();
  }
};

/**
 * Retrieve a prompt template by key and language.
 */
export const getPromptTemplate = async (
  promptKey: string,
  language: string = 'en',
  fallback?: string,
): Promise<string> => {
  const now = Date.now();
  const cacheKey = `${promptKey}_${language}`;
  const cached = promptCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.content;
  }

  const supabase = createSupabaseClient();
  // Try to get the prompt in the requested language
  let { data, error } = await supabase
    .from('ai_prompts')
    .select('content')
    .eq('prompt_key', promptKey)
    .eq('language', language)
    .maybeSingle();
  
  // If not found in requested language, fallback to English
  if (!data?.content && language !== 'en') {
    logWarn(`Prompt "${promptKey}" not found in language "${language}", falling back to English`);
    const result = await supabase
      .from('ai_prompts')
      .select('content')
      .eq('prompt_key', promptKey)
      .eq('language', 'en')
      .maybeSingle();
    
    data = result.data;
    error = result.error;
  }

  if (error) {
    logWarn(`Failed to fetch prompt "${promptKey}" from database`, error);
  }

  if (data?.content) {
    promptCache.set(cacheKey, {
      content: data.content,
      expiresAt: now + PROMPT_CACHE_TTL_MS,
    });
    return data.content;
  }

  if (fallback) {
    logWarn(`Using fallback prompt for key "${promptKey}" in language "${language}"`);
    promptCache.set(cacheKey, {
      content: fallback,
      expiresAt: now + PROMPT_CACHE_TTL_MS,
    });
    return fallback;
  }

  const message = `Prompt template not found for key "${promptKey}" in language "${language}"`;
  logError(message);
  throw new Error(message);
};

/**
 * Render a prompt template with the provided variables.
 */
export const renderPromptTemplate = (
  template: string,
  variables: Record<string, string | number | boolean | undefined | null>,
): string => {
  let rendered = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g');
    rendered = rendered.replace(placeholder, sanitizeValue(value));
  }

  return removeStalePlaceholders(rendered);
};


