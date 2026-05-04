/**
 * Records sanitized platform metrics into public.observability_metric_snapshots.
 *
 * Auth (either):
 *   - Header `x-cron-secret` matching Edge secret OBSERVABILITY_CRON_SECRET (for schedulers / Vercel Cron).
 *   - OR `Authorization: Bearer <user JWT>` and is_app_admin (manual "Record snapshot" from UI).
 *
 * Secrets: PAT_SUPABASE, VERCEL_ACCESS_TOKEN (optional), OBSERVABILITY_CRON_SECRET (for cron path).
 * Standard: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Schedule: Supabase Scheduled Edge Functions or external cron POST with x-cron-secret.
 * Deploy: supabase functions deploy collect-metric-snapshot
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseClient, isAppAdmin } from '../shared/supabase.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function projectRefFromUrl(url: string): string | null {
  const m = url.trim().match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

function sanitizeMgmtProject(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = ['id', 'ref', 'name', 'region', 'status', 'organization_id', 'inserted_at'];
  for (const k of keys) {
    if (k in raw) out[k] = raw[k];
  }
  const db = raw['database'];
  if (db && typeof db === 'object') {
    const d = db as Record<string, unknown>;
    out['database'] = {
      host: d['host'],
      version: d['version'],
      postgres_engine: d['postgres_engine'],
    };
  }
  return out;
}

async function measureDbLatencyMs(): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  const t0 = performance.now();
  try {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('classrooms').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - t0);
    if (error) return { ok: false, latencyMs, message: error.message };
    return { ok: true, latencyMs };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - t0);
    const msg = e instanceof Error ? e.message : 'Request failed';
    return { ok: false, latencyMs, message: msg };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      await persistEdgeFunctionLog(
        {
          functionName: 'collect-metric-snapshot',
          level: 'error',
          httpStatus: 500,
          message: 'Server configuration error',
        },
        req,
      );
      return json({ error: 'Server configuration error' }, 500);
    }

    const cronSecret = Deno.env.get('OBSERVABILITY_CRON_SECRET') ?? '';
    const headerCron = req.headers.get('x-cron-secret') ?? '';
    const authHeader = req.headers.get('Authorization');

    let authorized = false;
    if (cronSecret && headerCron === cronSecret) {
      authorized = true;
    } else if (authHeader?.startsWith('Bearer ')) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);
      if (!userError && user && (await isAppAdmin(user.id))) {
        authorized = true;
      }
    }

    if (!authorized) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const pat = Deno.env.get('PAT_SUPABASE') ?? '';
    const ref = projectRefFromUrl(supabaseUrl);
    const dbProbe = await measureDbLatencyMs();

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const managementPayload: Record<string, unknown> = {
      dbLatencyMs: dbProbe.latencyMs,
      dbOk: dbProbe.ok,
      dbMessage: dbProbe.message ?? null,
      projectRef: ref,
      managementProject: null as Record<string, unknown> | null,
      managementError: null as string | null,
    };

    if (pat && ref) {
      try {
        const res = await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
          headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json' },
        });
        if (res.ok) {
          const body = (await res.json()) as Record<string, unknown>;
          managementPayload.managementProject = sanitizeMgmtProject(body);
        } else {
          const text = await res.text();
          managementPayload.managementError = `HTTP ${res.status}: ${text.slice(0, 200)}`;
        }
      } catch (e) {
        managementPayload.managementError = e instanceof Error ? e.message : 'fetch failed';
      }
    } else {
      managementPayload.managementError = !pat ? 'PAT_SUPABASE not set' : 'Could not parse project ref';
    }

    const rowsToInsert: Array<{ source: string; payload: Record<string, unknown> }> = [
      { source: 'management_api', payload: managementPayload },
    ];

    const vercelToken = Deno.env.get('VERCEL_ACCESS_TOKEN') ?? '';
    if (vercelToken) {
      try {
        const projRes = await fetch('https://api.vercel.com/v9/projects', {
          headers: { Authorization: `Bearer ${vercelToken}`, Accept: 'application/json' },
        });
        let projectId: string | null = null;
        const projectsMeta: unknown[] = [];
        if (projRes.ok) {
          const body = (await projRes.json()) as { projects?: Array<{ id: string; name: string }> };
          for (const p of body.projects?.slice(0, 5) ?? []) {
            projectsMeta.push({ id: p.id, name: p.name });
          }
          projectId = body.projects?.[0]?.id ?? null;
        }
        const deployments: unknown[] = [];
        if (projectId) {
          const depRes = await fetch(
            `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=10`,
            { headers: { Authorization: `Bearer ${vercelToken}`, Accept: 'application/json' } },
          );
          if (depRes.ok) {
            const dbody = (await depRes.json()) as { deployments?: Array<Record<string, unknown>> };
            for (const d of dbody.deployments ?? []) {
              deployments.push({
                uid: d.uid,
                state: d.state,
                createdAt: d.createdAt,
                url: d.url,
              });
            }
          }
        }
        rowsToInsert.push({
          source: 'vercel',
          payload: { projectsMeta, deploymentSample: deployments },
        });
      } catch (e) {
        rowsToInsert.push({
          source: 'vercel',
          payload: { error: e instanceof Error ? e.message : 'vercel fetch failed' },
        });
      }
    }

    for (const row of rowsToInsert) {
      const { error: insErr } = await supabaseAdmin.from('observability_metric_snapshots').insert({
        source: row.source,
        payload: row.payload,
      });
      if (insErr) {
        console.error('snapshot insert', insErr);
        await persistEdgeFunctionLog(
          {
            functionName: 'collect-metric-snapshot',
            level: 'error',
            httpStatus: 500,
            message: insErr.message,
          },
          req,
        );
        return json({ error: insErr.message }, 500);
      }
    }

    return json({ ok: true, inserted: rowsToInsert.length });
  } catch (e) {
    console.error('collect-metric-snapshot', e);
    await persistEdgeFunctionLog(
      {
        functionName: 'collect-metric-snapshot',
        level: 'error',
        httpStatus: 500,
        message: e instanceof Error ? e.message : 'Internal error',
        stack: errorToStack(e),
      },
      req,
    );
    return json({ error: 'Internal error' }, 500);
  }
});
