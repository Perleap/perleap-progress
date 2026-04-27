/**
 * Admin-only platform probe: Supabase Management API, Vercel API, and app DB latency.
 *
 * Required Edge Function secrets (Supabase Dashboard → Edge Functions → Secrets):
 *   - PAT_SUPABASE          — Personal Access Token for https://api.supabase.com (not SUPABASE_*; reserved prefix)
 *   - VERCEL_ACCESS_TOKEN   — Vercel token for https://api.vercel.com
 * Optional:
 *   - VERCEL_TEAM_ID        — if your Vercel API calls need a team scope (not used by v2/user)
 *
 * Deploy: supabase functions deploy admin-monitoring-probe
 *
 * Manual checks (replace placeholders):
 *   curl -i -X POST "$SUPABASE_URL/functions/v1/admin-monitoring-probe" \
 *     -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $USER_ACCESS_TOKEN"
 * Expect: 401 without Authorization; 403 for non-admin JWT; 200 + JSON for app admin.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSupabaseClient, isAppAdmin } from '../shared/supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MGMT_API = 'https://api.supabase.com/v1';
const VERCEL_API = 'https://api.vercel.com';

export interface AdminMonitoringProbeResult {
  checkedAt: string;
  supabase: {
    ok: boolean;
    message?: string;
    projectName?: string;
    projectRef?: string;
    region?: string;
    projectCount?: number;
  };
  vercel: {
    ok: boolean;
    message?: string;
    userEmail?: string;
    username?: string;
  };
  db: {
    ok: boolean;
    latencyMs: number;
    message?: string;
  };
}

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

async function probeSupabaseManagement(pat: string, supabaseUrl: string): Promise<AdminMonitoringProbeResult['supabase']> {
  if (!pat) {
    return { ok: false, message: 'Secret PAT_SUPABASE is not set' };
  }

  const ref = projectRefFromUrl(supabaseUrl);

  try {
    const res = await fetch(`${MGMT_API}/projects`, {
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      const short = text.length > 120 ? `${text.slice(0, 120)}…` : text;
      return {
        ok: false,
        message: `Management API ${res.status}${short ? `: ${short}` : ''}`,
      };
    }

    const raw = (await res.json()) as unknown;
    const projects = Array.isArray(raw)
      ? raw
      : raw &&
          typeof raw === 'object' &&
          'projects' in raw &&
          Array.isArray((raw as { projects: unknown }).projects)
        ? (raw as { projects: Array<{ name?: string; ref?: string; region?: string; id?: string }> }).projects
        : null;

    if (!projects) {
      return { ok: false, message: 'Unexpected Management API response' };
    }

    const match = ref ? projects.find((p) => p.ref === ref) : undefined;
    const primary = match ?? projects[0];

    return {
      ok: true,
      projectCount: projects.length,
      projectName: primary?.name,
      projectRef: primary?.ref ?? ref ?? undefined,
      region: primary?.region,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return { ok: false, message: msg };
  }
}

async function probeVercel(token: string): Promise<AdminMonitoringProbeResult['vercel']> {
  if (!token) {
    return { ok: false, message: 'Secret VERCEL_ACCESS_TOKEN is not set' };
  }

  try {
    const res = await fetch(`${VERCEL_API}/v2/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!res.ok) {
      const text = await res.text();
      const short = text.length > 120 ? `${text.slice(0, 120)}…` : text;
      return {
        ok: false,
        message: `Vercel API ${res.status}${short ? `: ${short}` : ''}`,
      };
    }

    const body = (await res.json()) as { user?: { email?: string; username?: string } };
    const u = body.user;
    return {
      ok: true,
      userEmail: u?.email,
      username: u?.username,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Request failed';
    return { ok: false, message: msg };
  }
}

async function probeDb(): Promise<AdminMonitoringProbeResult['db']> {
  const t0 = performance.now();
  try {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('classrooms').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - t0);
    if (error) {
      return { ok: false, latencyMs, message: error.message };
    }
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

  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Server configuration error' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (!(await isAppAdmin(user.id))) {
      return json({ error: 'Forbidden' }, 403);
    }

    const pat = Deno.env.get('PAT_SUPABASE') ?? '';
    const vercelToken = Deno.env.get('VERCEL_ACCESS_TOKEN') ?? '';

    const [supabaseProbe, vercelProbe, dbProbe] = await Promise.all([
      probeSupabaseManagement(pat, supabaseUrl),
      probeVercel(vercelToken),
      probeDb(),
    ]);

    const body: AdminMonitoringProbeResult = {
      checkedAt: new Date().toISOString(),
      supabase: supabaseProbe,
      vercel: vercelProbe,
      db: dbProbe,
    };

    return json(body);
  } catch (e) {
    console.error('admin-monitoring-probe', e);
    return json({ error: 'Internal error' }, 500);
  }
});
