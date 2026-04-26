/**
 * LLM narratives for aggregated 5D analytics (class/student/module compare).
 *
 * After changing this function, redeploy: `npx supabase functions deploy explain-analytics-5d`
 * (or your CI equivalent). With code changes, run the manual checklist in the JSDoc at the
 * bottom of `src/lib/analytics5dEvidence.test.ts`.
 */
const EVIDENCE_MAX_TOTAL_CHARS = 10_000;import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import { isAppAdmin } from '../shared/supabase.ts';
import { logError, logInfo } from '../shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type FiveD = {
  vision: number;
  values: number;
  thinking: number;
  connection: number;
  action: number;
};

const DIMS = ['vision', 'values', 'thinking', 'connection', 'action'] as const;

function parseScores(raw: unknown): FiveD | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<FiveD> = {};
  for (const k of DIMS) {
    const v = o[k];
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    out[k] = n;
  }
  return out as FiveD;
}

async function assertCanAccessClassroom(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  classroomId: string,
): Promise<boolean> {
  const { data: classroom, error } = await supabase
    .from('classrooms')
    .select('teacher_id')
    .eq('id', classroomId)
    .maybeSingle();

  if (error || !classroom) return false;
  if ((classroom as { teacher_id: string }).teacher_id === userId) return true;
  return isAppAdmin(userId);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const classroomId = typeof body.classroomId === 'string' ? body.classroomId.trim() : '';
    const language = body.language === 'he' ? 'he' : 'en';
    const context = body.context as string;
    const filterSummary = typeof body.filterSummary === 'string' ? body.filterSummary.trim() : '';
    const studentName = typeof body.studentName === 'string' ? body.studentName.trim() : '';
    const compareLabelA = typeof body.compareLabelA === 'string' ? body.compareLabelA.trim() : '';
    const compareLabelB = typeof body.compareLabelB === 'string' ? body.compareLabelB.trim() : '';
    const evidenceText =
      typeof body.evidenceText === 'string' && body.evidenceText.trim()
        ? body.evidenceText.trim()
        : '';
    const evidenceSourceNote =
      typeof body.evidenceSourceNote === 'string' && body.evidenceSourceNote.trim()
        ? body.evidenceSourceNote.trim()
        : '';
    const evidenceSourceCount =
      typeof body.evidenceSourceCount === 'number' && Number.isFinite(body.evidenceSourceCount)
        ? body.evidenceSourceCount
        : undefined;

    const scores = parseScores(body.scores);
    const peerScores = body.peerScores != null ? parseScores(body.peerScores) : null;

    if (!classroomId || !scores) {
      return new Response(JSON.stringify({ error: 'classroomId and valid scores are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowed = ['class_avg', 'student_avg', 'module_compare'].includes(context);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Invalid context' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const canAccess = await assertCanAccessClassroom(supabase, user.id, classroomId);
    if (!canAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const langLine =
      language === 'he'
        ? 'Write all user-facing text in Hebrew.'
        : 'Write all user-facing text in English.';

    let roleLine = '';
    if (context === 'class_avg') {
      roleLine =
        'You explain aggregated 5D soft-skill means for an entire class (or filtered cohort) in an educational analytics dashboard.';
    } else if (context === 'student_avg') {
      roleLine =
        `You explain one student's aggregated 5D profile as means over their scoped work. Student name (if any): ${studentName || 'not specified'}.`;
    } else {
      roleLine =
        `You explain the 5D means for one syllabus section (\"${compareLabelA || 'A'}\") in a head-to-head comparison with another section (\"${compareLabelB || 'B'}\"). The JSON scores are for the first section only.`;
      if (peerScores) {
        roleLine += ` Peer section mean scores (for contrast, 0–10): ${JSON.stringify(peerScores)}`;
      }
    }

    const evidenceBlock =
      evidenceText.length > 0
        ? `
An evidence pack is provided below (trimmed text from student-facing AI feedback, per-dimension snapshot notes, and assignment instructions). When present, ground strengths, gaps, and next steps in this evidence. Do not invent or quote private text that is not in the evidence. If the evidence is thin, sparse, or missing for a dimension, say so clearly and still interpret the numbers.
${evidenceSourceNote ? `Source tags: ${evidenceSourceNote}.` : ''}
`
        : `
No supporting text evidence is available for this request; explain using the numeric means and filter only. If numbers look incomplete, state that the evidence is thin.
`;

    const systemPrompt = `${roleLine}
Dimensions: vision, values, thinking, connection, action. Scores are on a 0–10 scale (aggregated means). The JSON scores and filter are authoritative for magnitudes; supporting prose is for grounding only.
${evidenceBlock}
${langLine}
Return ONLY valid JSON with this exact shape (no markdown):
{
  "explanations": {
    "vision": "1-2 sentences interpreting this dimension for the current scope.",
    "values": "...",
    "thinking": "...",
    "connection": "...",
    "action": "..."
  },
  "scopeSummary": "One short paragraph (2-4 sentences) summarizing the overall 5D pattern for this scope and filter: ${filterSummary || '(no extra filter)'}."
}
Be specific to the numbers; avoid generic filler.`;

    const userContent = `Filter / scope: ${filterSummary || '—'}
Mean scores (0–10) for THIS view: ${JSON.stringify(scores)}${
      evidenceText.length > 0
        ? `

## Evidence (supporting; may be partial)
${evidenceText}`
        : ''
    }`;

    logInfo('explain-analytics-5d', {
      context,
      classroomId,
      language,
      evidenceTextLength: evidenceText.length,
      evidenceSourceCount: evidenceSourceCount ?? null,
      evidenceNearTotalCap: evidenceText.length >= EVIDENCE_MAX_TOTAL_CHARS * 0.95,
    });

    const { content } = await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: userContent }],
      0.4,
      1800,
      'fast',
      false,
      'json_object',
    );

    const parsed = JSON.parse(content) as {
      explanations?: Record<string, string>;
      scopeSummary?: string;
    };

    const expl = parsed.explanations || {};
    const explanations: Record<(typeof DIMS)[number], string> = {
      vision: String(expl.vision ?? '').trim() || `Score: ${scores.vision.toFixed(1)}`,
      values: String(expl.values ?? '').trim() || `Score: ${scores.values.toFixed(1)}`,
      thinking: String(expl.thinking ?? '').trim() || `Score: ${scores.thinking.toFixed(1)}`,
      connection: String(expl.connection ?? '').trim() || `Score: ${scores.connection.toFixed(1)}`,
      action: String(expl.action ?? '').trim() || `Score: ${scores.action.toFixed(1)}`,
    };

    const scopeSummary =
      typeof parsed.scopeSummary === 'string' && parsed.scopeSummary.trim()
        ? parsed.scopeSummary.trim()
        : '';

    return new Response(
      JSON.stringify({
        explanations,
        scopeSummary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    logError('explain-analytics-5d', e);
    const message = handleOpenAIError(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
