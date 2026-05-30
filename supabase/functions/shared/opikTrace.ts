/**
 * Fire-and-forget Opik trace batch ingest (REST) for Supabase Edge (Deno).
 * https://www.comet.com/docs/opik/reference/rest-api/overview
 *
 * When `clientTraceId` is set it becomes the Opik trace `id` (for feedback scoring)
 * and is also stored as `metadata.perleap_client_trace_id`.
 */

export const OPIK_FEEDBACK_SCORE_STUDENT_FLAG = 'student_flag';
export const OPIK_FEEDBACK_SCORE_TEACHER_FLAG = 'teacher_flag';

function opikApiBase(): string {
  const raw = Deno.env.get('OPIK_URL_OVERRIDE')?.trim();
  return raw ? raw.replace(/\/$/, '') : 'https://www.comet.com/opik/api';
}

function opikBatchUrl(): string {
  return `${opikApiBase()}/v1/private/traces/batch`;
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

  const trace: Record<string, unknown> = {
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
  if (params.clientTraceId) {
    trace.id = params.clientTraceId;
  }
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
