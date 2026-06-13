/**
 * OpenAI Client Wrapper
 * Shared utilities for OpenAI API calls
 */

import type { OpenAIConfig } from './types.ts';
import { inferAudioUploadName } from './audioFormat.ts';

/**
 * Get OpenAI configuration from environment
 */
export const getOpenAIConfig = (): OpenAIConfig => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured. Please set the environment variable.');
  }

  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-5.4';

  return { apiKey, model };
};

/**
 * Resolve the concrete model name used for a tier. Mirrors the tier logic in
 * `buildChatCompletionsPayload` / `buildResponsesApiPayload` so callers can report
 * the exact model to Opik for cost tracking without duplicating the mapping.
 */
export const resolveChatModel = (modelTier: 'fast' | 'smart' = 'smart'): string => {
  return modelTier === 'fast' ? 'gpt-4o-mini' : getOpenAIConfig().model;
};

/** GPT-5 chat/completions expects max_completion_tokens, not max_tokens (400 otherwise). */
const usesMaxCompletionTokens = (model: string): boolean => /^gpt-5/i.test(model.trim());

/**
 * GPT-5 reasoning-class models reject the `stop` parameter with a 400:
 *   "Unsupported parameter: 'stop' is not supported with this model."
 * Skip it for the gpt-5 family; keep it for older Chat Completions models.
 */
const modelSupportsStopParameter = (model: string): boolean => !/^gpt-5/i.test(model.trim());

/**
 * GPT-5 reasoning-class models reject a custom `temperature` with a 400:
 *   "Unsupported value: 'temperature' does not support 0.2 with this model. Only the default (1) value is supported."
 * Skip it for the gpt-5 family; keep it for older models.
 */
const modelSupportsTemperature = (model: string): boolean => !/^gpt-5/i.test(model.trim());

/** GPT-5 reasoning-class models support reasoning_effort; gpt-4o-mini does not. */
const modelSupportsReasoningEffort = (model: string): boolean => /^gpt-5/i.test(model.trim());

export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

export interface JsonSchemaResponseFormat {
  type: 'json_schema';
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

export type ChatResponseFormat = 'text' | 'json_object' | JsonSchemaResponseFormat;

export interface ChatCompletionPayloadOptions {
  systemPrompt: string;
  messages: unknown[];
  temperature?: number;
  maxTokens?: number;
  modelTier?: 'fast' | 'smart';
  stream?: boolean;
  responseFormat?: ChatResponseFormat;
  /** Optional stop sequences (Chat Completions). Use to prevent the model from hallucinating an extra user turn. */
  stop?: string[];
  /** Optional seed for more repeatable completions (when supported by the model). */
  seed?: number;
  /** Reasoning effort for gpt-5 family models only. Ignored for gpt-4o-mini. */
  reasoningEffort?: ReasoningEffort;
}

/**
 * Plain JSON body POSTed to `v1/chat/completions` (no secrets).
 * Mirrors `createChatCompletion` semantics so admins can introspect stored snapshots.
 */
function applyResponseFormat(
  requestBody: Record<string, unknown>,
  responseFormat: ChatResponseFormat,
): void {
  if (responseFormat === 'json_object') {
    requestBody.response_format = { type: 'json_object' };
    return;
  }
  if (typeof responseFormat === 'object' && responseFormat.type === 'json_schema') {
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: {
        name: responseFormat.name,
        strict: responseFormat.strict ?? true,
        schema: responseFormat.schema,
      },
    };
  }
}

export const buildChatCompletionsPayload = (
  systemPrompt: string,
  messages: unknown[],
  temperature = 0.7,
  maxTokens = 2000,
  modelTier: 'fast' | 'smart' = 'smart',
  stream = false,
  responseFormat: ChatResponseFormat = 'text',
  stop?: string[],
  seed?: number,
  reasoningEffort?: ReasoningEffort,
): Record<string, unknown> => {
  const config = getOpenAIConfig();
  const model = modelTier === 'fast' ? 'gpt-4o-mini' : config.model;

  const requestBody: Record<string, unknown> = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream,
  };
  if (modelSupportsTemperature(model)) {
    requestBody.temperature = temperature;
  }
  if (usesMaxCompletionTokens(model)) {
    requestBody.max_completion_tokens = maxTokens;
  } else {
    requestBody.max_tokens = maxTokens;
  }
  applyResponseFormat(requestBody, responseFormat);
  if (stop && stop.length > 0 && modelSupportsStopParameter(model)) {
    requestBody.stop = stop;
  }
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    requestBody.seed = Math.floor(seed);
  }
  if (reasoningEffort && modelSupportsReasoningEffort(model)) {
    requestBody.reasoning_effort = reasoningEffort;
  }
  if (stream && Deno.env.get('PERLEAP_CHAT_STREAM_USAGE') !== 'false') {
    requestBody.stream_options = { include_usage: true };
  }
  return requestBody;
};

/**
 * Execute a chat completion from a prebuilt payload object. Use this when you already have a
 * snapshot from `buildChatCompletionsPayload` and want to avoid building it twice.
 */
export const createChatCompletionFromPayload = async (
  payload: Record<string, unknown>,
): Promise<{ content: string; usage?: unknown } | Response> => {
  const config = getOpenAIConfig();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(await parseOpenAIError(response.status, errorText));
  }

  if (payload.stream === true) {
    return response;
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
};

/**
 * Create chat completion with OpenAI
 */
export const createChatCompletion = async (
  systemPrompt: string,
  messages: any[],
  temperature = 0.7,
  maxTokens = 2000,
  modelTier: 'fast' | 'smart' = 'smart',
  stream = false,
  responseFormat: ChatResponseFormat = 'text',
  seed?: number,
  reasoningEffort?: ReasoningEffort,
): Promise<{ content: string; usage?: unknown } | Response> => {
  const config = getOpenAIConfig();
  const requestBody = buildChatCompletionsPayload(
    systemPrompt,
    messages,
    temperature,
    maxTokens,
    modelTier,
    stream,
    responseFormat,
    undefined,
    seed,
    reasoningEffort,
  );

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
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
 * --- OpenAI Responses API (v1/responses) ---
 *
 * Used when PERLEAP_CHAT_USE_RESPONSES_API=true. Lets us pass the system prompt as a
 * `developer` instruction, chain turns with `previous_response_id` (so we don't replay full
 * history each turn), and consume native `response.output_text.delta` SSE events.
 */

/**
 * Thrown when OpenAI rejects a request because the supplied `previous_response_id` is unknown
 * or expired (responses have ~30-day TTL). Callers should catch this and retry the request
 * without `previous_response_id`, replaying the full conversation history as `input`.
 */
export class InvalidPreviousResponseIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPreviousResponseIdError';
  }
}

/**
 * Detect the specific "stale previous_response_id" failure shape. OpenAI returns this as either
 *   404: `previous_response_id ... not found`
 *   400: `Invalid value for previous_response_id`
 * Both contain the parameter name in the body, which is the cheapest signal to key off.
 */
function isInvalidPreviousResponseIdError(status: number, body: string): boolean {
  if (status !== 404 && status !== 400) return false;
  return /previous_response_id/i.test(body);
}
export interface ResponsesApiInputMessage {
  role: 'user' | 'assistant' | 'developer' | 'system';
  /** OpenAI accepts either a plain string or a content-parts array (e.g. for vision inputs). */
  content: unknown;
}

export interface ResponsesApiOptions {
  developerInstructions: string;
  input: ResponsesApiInputMessage[];
  previousResponseId?: string | null;
  stream?: boolean;
  modelTier?: 'fast' | 'smart';
  temperature?: number;
  maxOutputTokens?: number;
  stop?: string[];
}

export const buildResponsesApiPayload = (opts: ResponsesApiOptions): Record<string, unknown> => {
  const config = getOpenAIConfig();
  const model = opts.modelTier === 'fast' ? 'gpt-4o-mini' : config.model;
  const body: Record<string, unknown> = {
    model,
    instructions: opts.developerInstructions,
    input: opts.input,
    stream: opts.stream === true,
  };
  if (typeof opts.temperature === 'number' && modelSupportsTemperature(model)) {
    body.temperature = opts.temperature;
  }
  if (typeof opts.maxOutputTokens === 'number') body.max_output_tokens = opts.maxOutputTokens;
  if (opts.previousResponseId) body.previous_response_id = opts.previousResponseId;
  if (opts.stop && opts.stop.length > 0 && modelSupportsStopParameter(model)) {
    body.stop = opts.stop;
  }
  return body;
};

/**
 * Execute a Responses API call from a prebuilt payload.
 * - Non-streaming: returns `{ content, responseId, usage }`.
 * - Streaming: returns the raw `Response` so the caller can parse SSE events directly
 *   (event types: `response.output_text.delta`, `response.completed`, etc.).
 */
export const createResponseFromPayload = async (
  payload: Record<string, unknown>,
): Promise<{ content: string; responseId?: string; usage?: unknown } | Response> => {
  const config = getOpenAIConfig();
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (isInvalidPreviousResponseIdError(response.status, errorText)) {
      throw new InvalidPreviousResponseIdError(
        await parseOpenAIError(response.status, errorText),
      );
    }
    throw new Error(await parseOpenAIError(response.status, errorText));
  }

  if (payload.stream === true) {
    return response;
  }

  const data = await response.json();
  let content = '';
  if (typeof data.output_text === 'string') {
    content = data.output_text;
  } else if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item?.type === 'message' && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part?.type === 'output_text' && typeof part.text === 'string') {
            content += part.text;
          }
        }
      }
    }
  }
  return {
    content,
    responseId: typeof data.id === 'string' ? data.id : undefined,
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
  const uploadName = await inferAudioUploadName(audioFile);
  formData.append('file', audioFile, uploadName);
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

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface VerboseTranscription {
  text: string;
  segments: TranscriptionSegment[];
  duration: number;
}

/**
 * Transcribe with Whisper requesting `verbose_json` so we get segment-level timestamps.
 * Used by live-session transcription to build clickable timestamps.
 */
export const createVerboseTranscription = async (
  audioFile: Blob,
  language?: string,
  model = 'whisper-1',
): Promise<VerboseTranscription> => {
  const config = getOpenAIConfig();
  const formData = new FormData();
  const uploadName = await inferAudioUploadName(audioFile);
  formData.append('file', audioFile, uploadName);
  formData.append('model', model);
  formData.append('response_format', 'verbose_json');
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
  const segments: TranscriptionSegment[] = Array.isArray(data.segments)
    ? data.segments.map((s: { start: number; end: number; text: string }) => ({
        start: s.start,
        end: s.end,
        text: (s.text ?? '').trim(),
      }))
    : [];
  return {
    text: data.text ?? '',
    segments,
    duration: typeof data.duration === 'number' ? data.duration : 0,
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
    return error.message;
  }
  return 'An unexpected error occurred with OpenAI';
};

