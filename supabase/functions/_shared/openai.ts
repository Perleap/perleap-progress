/**
 * OpenAI Client Wrapper
 * Shared utilities for OpenAI API calls
 */

import type { Message, OpenAIConfig } from './types.ts';

/**
 * Get OpenAI configuration from environment
 */
export const getOpenAIConfig = (): OpenAIConfig => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured. Please set the environment variable.');
  }

  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4-turbo-preview';

  return { apiKey, model };
};

/**
 * Create chat completion with OpenAI
 */
export const createChatCompletion = async (
  systemPrompt: string,
  messages: Message[],
  temperature = 0.7,
  maxTokens = 2000,
): Promise<{ content: string; usage?: unknown }> => {
  const config = getOpenAIConfig();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(await parseOpenAIError(response.status, errorText));
  }

  const data = await response.json();

  // Log token usage for monitoring
  if (data.usage) {
    console.log('OpenAI token usage:', data.usage);
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
};

/**
 * Parse OpenAI error response
 */
const parseOpenAIError = async (status: number, errorText: string): Promise<string> => {
  try {
    const errorData = JSON.parse(errorText);
    const errorMessage = errorData.error?.message || errorText;
    return `OpenAI API error (${status}): ${errorMessage}`;
  } catch {
    return `OpenAI API error: ${status}`;
  }
};

/**
 * Handle OpenAI errors consistently
 */
export const handleOpenAIError = (error: unknown): string => {
  if (error instanceof Error) {
    console.error('OpenAI Error:', error.message);
    return error.message;
  }
  console.error('Unknown OpenAI Error:', error);
  return 'An unexpected error occurred with OpenAI';
};

