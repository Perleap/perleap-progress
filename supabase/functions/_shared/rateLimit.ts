/**
 * Per-user rate limiting for OpenAI proxy edge functions (Postgres-backed).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import { createSupabaseClient } from '../shared/supabase.ts';

export type RateLimitFailure = {
  status: 429;
  body: string;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  perMinute?: number;
  perDay?: number;
};

const DEFAULT_LIMITS: Required<RateLimitOptions> = {
  perMinute: 30,
  perDay: 200,
};

export function rateLimitFailureToResponse(
  failure: RateLimitFailure,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(failure.body, {
    status: failure.status,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(failure.retryAfterSeconds),
      ...extraHeaders,
    },
  });
}

export async function checkRateLimit(
  userId: string,
  functionName: string,
  supabase: SupabaseClient = createSupabaseClient(),
  options: RateLimitOptions = {},
): Promise<RateLimitFailure | null> {
  const limits = { ...DEFAULT_LIMITS, ...options };

  const { data, error } = await supabase.rpc('check_and_increment_api_rate_limit', {
    p_user_id: userId,
    p_function_name: functionName,
    p_minute_limit: limits.perMinute,
    p_day_limit: limits.perDay,
  });

  if (error) {
    console.error('Rate limit RPC failed:', error.message);
    return null;
  }

  const result = data as {
    allowed?: boolean;
    retry_after_seconds?: number;
    reason?: string;
  } | null;

  if (result?.allowed !== false) {
    return null;
  }

  const retryAfterSeconds =
    typeof result?.retry_after_seconds === 'number' && result.retry_after_seconds > 0
      ? Math.ceil(result.retry_after_seconds)
      : 60;

  const reason = result?.reason === 'day' ? 'daily' : 'per-minute';

  return {
    status: 429,
    body: JSON.stringify({
      error: `Rate limit exceeded (${reason}). Try again later.`,
    }),
    retryAfterSeconds,
  };
}
