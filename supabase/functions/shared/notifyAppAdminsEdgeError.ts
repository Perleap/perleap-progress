/**
 * Send Resend alert to app admins when an edge function error row is inserted.
 * Throttled project-wide to avoid email storms.
 */

import { createSupabaseClient } from './supabase.ts';

const MAX_EMAILS_PER_WINDOW = 10;

export type NotifyEdgeErrorArgs = {
  logId: string;
  functionName: string;
  httpStatus?: number | null;
  message: string;
  context?: Record<string, unknown> | null;
  requestId?: string | null;
};

export async function notifyAppAdminsEdgeError(args: NotifyEdgeErrorArgs): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return;

  const from =
    Deno.env.get('RESEND_FROM') ?? 'Perleap Alerts <onboarding@resend.dev>';
  const cooldownMin = parseInt(Deno.env.get('EDGE_ERROR_ALERT_COOLDOWN_MIN') ?? '15', 10);
  const windowMs = Math.max(1, cooldownMin) * 60_000;
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  try {
    const supabase = createSupabaseClient();

    const { count, error: countErr } = await supabase
      .from('edge_function_error_log')
      .select('*', { count: 'exact', head: true })
      .not('email_sent_at', 'is', null)
      .gte('created_at', windowStart);

    if (countErr) {
      console.error('notifyAppAdminsEdgeError throttle count', countErr);
      return;
    }
    if ((count ?? 0) >= MAX_EMAILS_PER_WINDOW) {
      console.warn('notifyAppAdminsEdgeError: throttle cap, skipping email');
      return;
    }

    const { data: admins, error: adminsErr } = await supabase
      .from('app_admins')
      .select('user_id');

    if (adminsErr || !admins?.length) {
      if (adminsErr) console.error('notifyAppAdminsEdgeError app_admins', adminsErr);
      return;
    }

    const emails: string[] = [];
    for (const row of admins) {
      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(
        row.user_id,
      );
      if (!userErr && userData.user?.email) {
        emails.push(userData.user.email);
      }
    }
    if (!emails.length) return;

    const statusLine =
      args.httpStatus != null ? `HTTP ${args.httpStatus}` : 'no status';
    const ctxJson =
      args.context && Object.keys(args.context).length > 0
        ? `<pre style="background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${escapeHtml(
            JSON.stringify(args.context, null, 2),
          )}</pre>`
        : '';
    const reqLine = args.requestId
      ? `<p><strong>Request ID:</strong> ${escapeHtml(args.requestId)}</p>`
      : '';

    const subject = `[Perleap] Edge error: ${args.functionName}`;
    const html = `<!DOCTYPE html><html><body><div style="font-family:system-ui,sans-serif;max-width:640px;">
<h2 style="color:#dc2626;">Edge function error</h2>
<p><strong>Function:</strong> ${escapeHtml(args.functionName)}</p>
<p><strong>Status:</strong> ${escapeHtml(statusLine)}</p>
${reqLine}
<p><strong>Message:</strong></p>
<p>${escapeHtml(args.message)}</p>
${ctxJson}
<p style="color:#71717a;font-size:12px;margin-top:24px;">Log id: ${escapeHtml(args.logId)}</p>
</div></body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: emails,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      console.error('notifyAppAdminsEdgeError Resend', await res.text());
      return;
    }

    const sentAt = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('edge_function_error_log')
      .update({ email_sent_at: sentAt })
      .eq('id', args.logId);

    if (updErr) {
      console.error('notifyAppAdminsEdgeError update email_sent_at', updErr);
    }
  } catch (e) {
    console.error('notifyAppAdminsEdgeError', e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
