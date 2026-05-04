/**
 * Insert a row into edge_function_error_log (service role). Never throws.
 * For level "error", optionally emails app admins (Resend + throttle).
 */

import { createSupabaseClient } from './supabase.ts';
import { notifyAppAdminsEdgeError } from './notifyAppAdminsEdgeError.ts';

const MAX_MSG = 2000;
const MAX_STACK = 4000;

export type EdgeLogLevel = 'error' | 'warn' | 'info';

export type PersistEdgeFunctionLogParams = {
  functionName: string;
  level: EdgeLogLevel;
  httpStatus?: number | null;
  message: string;
  context?: Record<string, unknown> | null;
  stack?: string | null;
  requestId?: string | null;
};

export function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : JSON.stringify(error);
}

export function errorToStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) return error.stack;
  return null;
}

/**
 * @param req Optional request to read x-deno-request-id when requestId omitted
 */
export async function persistEdgeFunctionLog(
  params: PersistEdgeFunctionLogParams,
  req?: Request,
): Promise<void> {
  try {
    const supabase = createSupabaseClient();
    const requestId =
      params.requestId ?? req?.headers.get('x-deno-request-id') ?? null;
    const msg = params.message.slice(0, MAX_MSG);
    const stackSnip = params.stack ? params.stack.slice(0, MAX_STACK) : null;

    const { data, error } = await supabase
      .from('edge_function_error_log')
      .insert({
        function_name: params.functionName,
        level: params.level,
        http_status: params.httpStatus ?? null,
        error_message: msg,
        context: params.context ?? null,
        stack_snippet: stackSnip,
        request_id: requestId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('persistEdgeFunctionLog insert failed', error);
      return;
    }

    if (params.level === 'error' && data?.id) {
      await notifyAppAdminsEdgeError({
        logId: data.id,
        functionName: params.functionName,
        httpStatus: params.httpStatus,
        message: msg,
        context: params.context ?? undefined,
        requestId,
      });
    }
  } catch (e) {
    console.error('persistEdgeFunctionLog', e);
  }
}
