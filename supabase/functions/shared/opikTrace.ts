/**
 * Fire-and-forget Opik trace batch ingest (REST) for Supabase Edge (Deno).
 * https://www.comet.com/docs/opik/reference/rest-api/overview
 *
 * When `clientTraceId` is set it becomes the Opik trace `id` (for feedback scoring)
 * and is also stored as `metadata.perleap_client_trace_id`.
 */

export const OPIK_FEEDBACK_SCORE_STUDENT_FLAG = 'student_flag';
export const OPIK_FEEDBACK_SCORE_TEACHER_FLAG = 'teacher_flag';

const UUID_V7_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Whether a string is a valid UUIDv7 (required by Opik for trace ids). */
export function isUuidV7(value: string): boolean {
  return UUID_V7_REGEX.test(value);
}

/**
 * Generate a UUIDv7 (time-ordered). Opik requires trace/span ids to be v7;
 * `crypto.randomUUID()` returns v4, which Opik silently rejects.
 */
export function uuidv7(): string {
  const ts = Date.now();
  const b = new Uint8Array(16);
  b[0] = (ts / 2 ** 40) & 0xff;
  b[1] = (ts / 2 ** 32) & 0xff;
  b[2] = (ts / 2 ** 24) & 0xff;
  b[3] = (ts / 2 ** 16) & 0xff;
  b[4] = (ts / 2 ** 8) & 0xff;
  b[5] = ts & 0xff;
  crypto.getRandomValues(b.subarray(6));
  b[6] = (b[6] & 0x0f) | 0x70; // version 7
  b[8] = (b[8] & 0x3f) | 0x80; // variant
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function opikApiBase(): string {
  const raw = Deno.env.get('OPIK_URL_OVERRIDE')?.trim();
  return raw ? raw.replace(/\/$/, '') : 'https://www.comet.com/opik/api';
}

function opikBatchUrl(): string {
  return `${opikApiBase()}/v1/private/traces/batch`;
}

function opikSpansBatchUrl(): string {
  return `${opikApiBase()}/v1/private/spans/batch`;
}

function opikFeedbackScoresUrl(): string {
  return `${opikApiBase()}/v1/private/traces/feedback-scores`;
}

function opikAuthHeaders(): { headers: Record<string, string> } | null {
  const apiKey = Deno.env.get('OPIK_API_KEY')?.trim();
  const workspace = Deno.env.get('OPIK_WORKSPACE')?.trim();
  if (!apiKey || !workspace) return null;
  return {
    headers: {
      'Content-Type': 'application/json',
      'Comet-Workspace': workspace,
      'authorization': apiKey,
    },
  };
}

function defaultProjectName(override?: string): string {
  return (
    override?.trim() ||
    Deno.env.get('OPIK_PROJECT_NAME')?.trim() ||
    'pearleap-student-chat'
  );
}

const BODY_TRUNCATE_CHARS = 4096;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

/** Opik-compatible (OpenAI-style) token usage shape used for cost calculation. */
export type OpikTokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

/**
 * Normalize a provider-specific usage object into Opik's OpenAI-style keys
 * (`prompt_tokens` / `completion_tokens` / `total_tokens`). Opik only computes
 * cost from these exact field names. Returns `null` when the shape is unrecognized.
 */
export function normalizeOpikTokenUsage(raw: unknown): OpikTokenUsage | null {
  if (!raw || typeof raw !== 'object') return null;
  const u = raw as Record<string, unknown>;

  // OpenAI Chat Completions: prompt_tokens / completion_tokens / total_tokens
  if (typeof u.prompt_tokens === 'number' && typeof u.completion_tokens === 'number') {
    return {
      prompt_tokens: u.prompt_tokens,
      completion_tokens: u.completion_tokens,
      total_tokens:
        typeof u.total_tokens === 'number'
          ? u.total_tokens
          : u.prompt_tokens + u.completion_tokens,
    };
  }

  // OpenAI Responses API: input_tokens / output_tokens / total_tokens
  if (typeof u.input_tokens === 'number' && typeof u.output_tokens === 'number') {
    return {
      prompt_tokens: u.input_tokens,
      completion_tokens: u.output_tokens,
      total_tokens:
        typeof u.total_tokens === 'number'
          ? u.total_tokens
          : u.input_tokens + u.output_tokens,
    };
  }

  // Gemini / Google AI: promptTokenCount / candidatesTokenCount / totalTokenCount
  if (typeof u.promptTokenCount === 'number') {
    const prompt = u.promptTokenCount;
    const completion =
      typeof u.candidatesTokenCount === 'number' ? u.candidatesTokenCount : 0;
    return {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens:
        typeof u.totalTokenCount === 'number' ? u.totalTokenCount : prompt + completion,
    };
  }

  return null;
}

/**
 * Per-token USD pricing for models Opik may not have in its built-in table.
 * Used to compute a manual `total_cost` so cost never renders as "-".
 * NOTE: gpt-5.5 standard tier is $5/1M input, $30/1M output. Prompts above
 * 272K input tokens are billed at $10/$45; that breakpoint is intentionally
 * not handled here because current flows stay well under it.
 */
const MODEL_PRICING_USD_PER_TOKEN: Record<string, { input: number; output: number }> = {
  'gpt-5.5': { input: 5e-6, output: 30e-6 },
  'gpt-4o-mini': { input: 0.15e-6, output: 0.6e-6 },
};

function lookupModelPricing(model: string): { input: number; output: number } | undefined {
  const m = model.trim();
  if (MODEL_PRICING_USD_PER_TOKEN[m]) return MODEL_PRICING_USD_PER_TOKEN[m];
  for (const [key, price] of Object.entries(MODEL_PRICING_USD_PER_TOKEN)) {
    if (m.startsWith(key)) return price;
  }
  return undefined;
}

/**
 * Estimate the USD cost of an LLM call from normalized usage. Returns `undefined`
 * when the model is not in our price map (Opik will then attempt its own calc).
 */
export function estimateLlmCostUsd(
  model: string | undefined,
  usage: OpikTokenUsage | null,
): number | undefined {
  if (!model || !usage) return undefined;
  const price = lookupModelPricing(model);
  if (!price) return undefined;
  return usage.prompt_tokens * price.input + usage.completion_tokens * price.output;
}

/** Shallow sanitize: truncate strings; stringify other values then truncate. */
function shallowTruncateRecord(
  r: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'string') {
      out[k] = truncate(v, BODY_TRUNCATE_CHARS);
    } else if (v === null || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else {
      out[k] = truncate(JSON.stringify(v), BODY_TRUNCATE_CHARS);
    }
  }
  return out;
}

export type QueueOpikTraceParams = {
  traceName: string;
  tags: string[];
  threadId: string;
  clientTraceId?: string;
  traceStartMs: number;
  traceEndMs: number;
  ttftMs?: number;
  /**
   * Chat-style input/output (used when `input` / `output` are omitted).
   */
  userMessage?: string;
  assistantMessage?: string;
  /** Generic trace payload; takes precedence over userMessage/assistantMessage when set. */
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  openaiUsage?: unknown;
  /**
   * Resolved model name for Opik cost tracking, e.g. `gpt-4o-mini` or `gpt-5.5`.
   * When set together with usage, an LLM span is emitted so Opik can compute cost.
   */
  llmModel?: string;
  /** Opik provider id (e.g. `openai`, `google_ai`); defaults to `openai`. */
  llmProvider?: string;
  /** Optional LLM span name; defaults to `${traceName}.llm`. */
  llmSpanName?: string;
  /** Override project; else `OPIK_PROJECT_NAME` or `pearleap-student-chat`. */
  projectName?: string;
};

export type QueueOpikFeedbackScoreParams = {
  traceId: string;
  name: typeof OPIK_FEEDBACK_SCORE_STUDENT_FLAG | typeof OPIK_FEEDBACK_SCORE_TEACHER_FLAG | string;
  value?: number;
  reason?: string;
  projectName?: string;
};

function resolveInputOutput(params: QueueOpikTraceParams): {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
} {
  if (params.input !== undefined || params.output !== undefined) {
    return {
      input: params.input ? shallowTruncateRecord(params.input) : {},
      output: params.output ? shallowTruncateRecord(params.output) : {},
    };
  }
  return {
    input: {
      userMessage: truncate(params.userMessage ?? '', BODY_TRUNCATE_CHARS),
    },
    output: {
      assistantMessage: truncate(params.assistantMessage ?? '', BODY_TRUNCATE_CHARS),
    },
  };
}

/**
 * Posts one trace to Opik. Caller should not await; use
 * `void queueOpikTrace(...).catch(() => undefined)`.
 */
export async function queueOpikTrace(params: QueueOpikTraceParams): Promise<void> {
  if (Deno.env.get('OPIK_TRACE_DISABLE') === 'true') return;

  const auth = opikAuthHeaders();
  if (!auth) return;

  const projectName = defaultProjectName(params.projectName);
  const environment = Deno.env.get('OPIK_ENVIRONMENT')?.trim();

  const { input, output } = resolveInputOutput(params);

  const metadata: Record<string, unknown> = { ...shallowTruncateRecord(params.metadata) };
  if (params.openaiUsage !== undefined && params.openaiUsage !== null) {
    metadata.openai_usage = params.openaiUsage;
  }
  if (params.clientTraceId) {
    metadata.perleap_client_trace_id = params.clientTraceId;
  }

  // Resolve a known trace id so any child LLM span can attach to this trace.
  // Reuse the caller's clientTraceId when it is a valid UUIDv7, else generate one.
  const traceId =
    params.clientTraceId && isUuidV7(params.clientTraceId)
      ? params.clientTraceId
      : uuidv7();

  const trace: Record<string, unknown> = {
    id: traceId,
    name: params.traceName,
    start_time: isoFromMs(params.traceStartMs),
    end_time: isoFromMs(params.traceEndMs),
    project_name: projectName,
    thread_id: params.threadId,
    input,
    output,
    metadata,
    tags: params.tags,
    source: 'sdk',
  };
  if (environment) trace.environment = environment;

  if (
    params.ttftMs !== undefined &&
    Number.isFinite(params.ttftMs) &&
    params.ttftMs >= 0
  ) {
    trace.ttft = params.ttftMs;
  }

  const body = JSON.stringify({ traces: [trace] });
  const batchUrl = opikBatchUrl();

  const res = await fetch(batchUrl, {
    method: 'POST',
    headers: auth.headers,
    body,
  });

  if (!res.ok) {
    const hint = await res.text().catch(() => '');
    throw new Error(`Opik trace batch failed: ${res.status} ${hint.slice(0, 200)}`);
  }

  await queueOpikLlmSpan(params, {
    auth,
    projectName,
    traceId,
    input,
    output,
  });
}

/**
 * Posts a child `type: "llm"` span (provider/model/usage) so Opik can compute
 * estimated cost. No-op unless the caller supplied both a model and a usage
 * object that normalizes to OpenAI-style token counts. A manual `total_cost`
 * is attached when the model is in our price map (overrides Opik's own calc).
 */
async function queueOpikLlmSpan(
  params: QueueOpikTraceParams,
  ctx: {
    auth: { headers: Record<string, string> };
    projectName: string;
    traceId: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  },
): Promise<void> {
  const model = params.llmModel?.trim();
  const usage = normalizeOpikTokenUsage(params.openaiUsage);
  if (!model || !usage) return;

  const provider = params.llmProvider?.trim() || 'openai';
  const totalCost = estimateLlmCostUsd(model, usage);

  const span: Record<string, unknown> = {
    id: uuidv7(),
    trace_id: ctx.traceId,
    project_name: ctx.projectName,
    name: params.llmSpanName ?? `${params.traceName}.llm`,
    type: 'llm',
    start_time: isoFromMs(params.traceStartMs),
    end_time: isoFromMs(params.traceEndMs),
    provider,
    model,
    usage,
    input: ctx.input,
    output: ctx.output,
    source: 'sdk',
  };
  if (totalCost !== undefined && Number.isFinite(totalCost)) {
    span.total_cost = totalCost;
  }

  if (Deno.env.get('OPIK_COST_DEBUG') === 'true') {
    console.log('[opik-cost]', JSON.stringify({
      traceId: ctx.traceId,
      provider,
      model,
      usage,
      total_cost: span.total_cost ?? null,
    }));
  }

  const res = await fetch(opikSpansBatchUrl(), {
    method: 'POST',
    headers: ctx.auth.headers,
    body: JSON.stringify({ spans: [span] }),
  });

  if (!res.ok) {
    const hint = await res.text().catch(() => '');
    throw new Error(`Opik span batch failed: ${res.status} ${hint.slice(0, 200)}`);
  }
}

/**
 * Posts a human feedback score to an existing Opik trace.
 * Caller should not await; use `void queueOpikFeedbackScore(...).catch(() => undefined)`.
 */
export async function queueOpikFeedbackScore(
  params: QueueOpikFeedbackScoreParams,
): Promise<void> {
  if (Deno.env.get('OPIK_TRACE_DISABLE') === 'true') return;

  const auth = opikAuthHeaders();
  if (!auth) return;

  const projectName = defaultProjectName(params.projectName);
  const reason = params.reason ? truncate(params.reason, BODY_TRUNCATE_CHARS) : undefined;

  const body = JSON.stringify({
    scores: [
      {
        id: params.traceId,
        project_name: projectName,
        name: params.name,
        value: params.value ?? 0,
        source: 'ui',
        ...(reason ? { reason } : {}),
      },
    ],
  });

  const res = await fetch(opikFeedbackScoresUrl(), {
    method: 'PUT',
    headers: auth.headers,
    body,
  });

  if (!res.ok) {
    const hint = await res.text().catch(() => '');
    throw new Error(`Opik feedback score failed: ${res.status} ${hint.slice(0, 200)}`);
  }
}
