/**
 * SSE consumers for the two OpenAI APIs we may stream from:
 *  - Chat Completions: `data: {choices:[{delta:{content:"..."}}]}` lines.
 *  - Responses API:    `event: response.output_text.delta` + `data: {delta:"..."}` lines, plus
 *                       `event: response.completed` with the final `id`.
 *
 * Both consumers call `onDelta(text)` for each new token chunk. The Responses-API consumer also
 * captures the response id so the caller can persist it for previous_response_id chaining.
 */

interface ChatCompletionsHandlers {
  onDelta: (text: string) => void;
  /** Final chunk (or usage-only chunk) may include `usage` when `stream_options.include_usage` is set */
  onUsage?: (usage: unknown) => void;
}

interface ResponsesApiHandlers {
  onDelta: (text: string) => void;
  onResponseId?: (id: string) => void;
  onUsage?: (usage: unknown) => void;
}

export async function consumeChatCompletionsStream(
  response: Response,
  handlers: ChatCompletionsHandlers,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let pending = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    let nlIdx: number;
    while ((nlIdx = pending.indexOf('\n')) !== -1) {
      const line = pending.slice(0, nlIdx);
      pending = pending.slice(nlIdx + 1);
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        if (parsed?.usage != null && handlers.onUsage) {
          handlers.onUsage(parsed.usage);
        }
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) handlers.onDelta(delta);
      } catch {
        // ignore partial / unexpected JSON
      }
    }
  }
  decoder.decode();
}

export async function consumeResponsesApiStream(
  response: Response,
  handlers: ResponsesApiHandlers,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let pending = '';
  let currentEvent: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    let nlIdx: number;
    while ((nlIdx = pending.indexOf('\n')) !== -1) {
      const rawLine = pending.slice(0, nlIdx);
      pending = pending.slice(nlIdx + 1);
      const line = rawLine.replace(/\r$/, '');
      if (line === '') {
        currentEvent = null;
        continue;
      }
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload);
        if (currentEvent === 'response.output_text.delta') {
          const delta = parsed?.delta;
          if (typeof delta === 'string' && delta) handlers.onDelta(delta);
        } else if (currentEvent === 'response.completed') {
          const id = parsed?.response?.id;
          if (typeof id === 'string' && id && handlers.onResponseId) {
            handlers.onResponseId(id);
          }
          const usage = parsed?.response?.usage ?? parsed?.usage;
          if (usage != null && handlers.onUsage) {
            handlers.onUsage(usage);
          }
        }
      } catch {
        // ignore partial / unexpected JSON
      }
    }
  }
  decoder.decode();
}
