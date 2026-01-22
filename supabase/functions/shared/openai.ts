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

  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o';

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
  modelTier: 'fast' | 'smart' = 'smart',
  stream = false,
  responseFormat: 'text' | 'json_object' = 'text',
): Promise<{ content: string; usage?: unknown } | Response> => {
  const config = getOpenAIConfig();
  
  // Use gpt-4o-mini for fast tier, gpt-4o for smart tier
  const model = modelTier === 'fast' ? 'gpt-4o-mini' : config.model;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature,
      max_tokens: maxTokens,
      stream,
      response_format: { type: responseFormat }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(await parseOpenAIError(response.status, errorText));
  }

  if (stream) {
    return response;
  }

  const data = await response.json();

  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
};

/**
 * Create speech from text with OpenAI
 */
export const createSpeech = async (
  text: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'shimmer',
  model = 'tts-1',
): Promise<Response> => {
  const config = getOpenAIConfig();

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(await parseOpenAIError(response.status, errorText));
  }

  return response;
};

/**
 * Transcribe speech to text with OpenAI Whisper
 */
export const createTranscription = async (
  audioFile: Blob,
  language?: string,
  model = 'whisper-1',
): Promise<string> => {
  const config = getOpenAIConfig();
  const formData = new FormData();
  formData.append('file', audioFile, 'audio.webm');
  formData.append('model', model);
  if (language) {
    formData.append('language', language);
  }

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(await parseOpenAIError(response.status, errorText));
  }

  const data = await response.json();
  return data.text;
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
    return error.message;
  }
  return 'An unexpected error occurred with OpenAI';
};

