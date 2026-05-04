/**
 * Admin-only: returns sanitized Vercel projects + recent deployments (no token in response).
 * Deploy: supabase functions deploy admin-vercel-insights
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isAppAdmin } from '../shared/supabase.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
      await persistEdgeFunctionLog(
        {
          functionName: 'admin-vercel-insights',
          level: 'error',
          httpStatus: 500,
          message: 'Server configuration error',
        },
        req,
      );
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

    const vercelToken = Deno.env.get('VERCEL_ACCESS_TOKEN') ?? '';
    if (!vercelToken) {
      return json({
        ok: false,
        message: 'VERCEL_ACCESS_TOKEN not set',
        projects: [],
        deployments: [],
      });
    }

    const projRes = await fetch('https://api.vercel.com/v9/projects', {
      headers: { Authorization: `Bearer ${vercelToken}`, Accept: 'application/json' },
    });

    if (!projRes.ok) {
      const text = await projRes.text();
      return json({
        ok: false,
        message: `Vercel projects ${projRes.status}: ${text.slice(0, 200)}`,
        projects: [],
        deployments: [],
      });
    }

    const body = (await projRes.json()) as { projects?: Array<{ id: string; name: string; framework?: string }> };
    const projects = (body.projects ?? []).slice(0, 20).map((p) => ({
      id: p.id,
      name: p.name,
      framework: p.framework ?? null,
    }));

    const projectId = projects[0]?.id;
    let deployments: Array<{ uid: string; state: string; createdAt: number; url?: string }> = [];

    if (projectId) {
      const depRes = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=25`,
        { headers: { Authorization: `Bearer ${vercelToken}`, Accept: 'application/json' } },
      );
      if (depRes.ok) {
        const dbody = (await depRes.json()) as {
          deployments?: Array<{ uid: string; state: string; createdAt: number; url?: string }>;
        };
        deployments =
          dbody.deployments?.map((d) => ({
            uid: d.uid,
            state: d.state,
            createdAt: d.createdAt,
            url: d.url,
          })) ?? [];
      }
    }

    return json({
      ok: true,
      checkedAt: new Date().toISOString(),
      projects,
      deployments,
    });
  } catch (e) {
    console.error('admin-vercel-insights', e);
    await persistEdgeFunctionLog(
      {
        functionName: 'admin-vercel-insights',
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
