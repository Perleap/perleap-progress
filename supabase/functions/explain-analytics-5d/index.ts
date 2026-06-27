/**
 * LLM narratives for aggregated 5D analytics (class/student/module compare).
 *
 * After changing this function, redeploy: `npx supabase functions deploy explain-analytics-5d`
 * (or your CI equivalent). With code changes, run the manual checklist in the JSDoc at the
 * bottom of `src/lib/analytics5dEvidence.test.ts`.
 */
const EVIDENCE_MAX_TOTAL_CHARS = 10_000;

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createChatCompletion, handleOpenAIError, resolveChatModel } from '../shared/openai.ts';
import { isAppAdmin, getServiceRoleKey } from '../shared/supabase.ts';
import { logError, logInfo } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';

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
    const serviceKey = getServiceRoleKey();
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
    const brief = body.brief === true;

    const scores = parseScores(body.scores);
    const peerScores = body.peerScores != null ? parseScores(body.peerScores) : null;

    if (!classroomId || !scores) {
      return new Response(JSON.stringify({ error: 'classroomId and valid scores are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowed = [
      'class_avg',
      'student_avg',
      'module_compare',
      'student_compare',
      'assignment_compare',
    ].includes(context);
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
    } else if (context === 'student_compare') {
      roleLine =
        `You explain the 5D means for one student (\"${compareLabelA || 'A'}\") in a head-to-head comparison with another student (\"${compareLabelB || 'B'}\"). The JSON scores are for the first student only.`;
      if (peerScores) {
        roleLine += ` Peer student mean scores (for contrast, 0–10): ${JSON.stringify(peerScores)}`;
      }
    } else if (context === 'assignment_compare') {
      roleLine =
        `You explain the class-wide 5D means for one assignment (\"${compareLabelA || 'A'}\") in a head-to-head comparison with another assignment (\"${compareLabelB || 'B'}\"). The JSON scores are for the first assignment only.`;
      if (peerScores) {
        roleLine += ` Peer assignment mean scores (for contrast, 0–10): ${JSON.stringify(peerScores)}`;
      }
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

    const jsonSchema = brief
      ? `{
  "explanations": {
    "vision": "1 short sentence interpreting this dimension.",
    "values": "...",
    "thinking": "...",
    "connection": "...",
    "action": "..."
  },
  "scopeSummary": "2-3 concise sentences summarizing the overall 5D pattern for this scope and filter: ${filterSummary || '(no extra filter)'}.",
  "strengths": ["One strength, max 15 words"],
  "weaknesses": ["One area for improvement, max 15 words"],
  "nextSteps": ["One actionable next step for the teacher, max 15 words"]
}
Be telegraphic. No filler. Exactly 1 bullet per list unless a second is essential. Every word must earn its place.`
      : `{
  "explanations": {
    "vision": "1-2 sentences interpreting this dimension for the current scope.",
    "values": "...",
    "thinking": "...",
    "connection": "...",
    "action": "..."
  },
  "scopeSummary": "A detailed paragraph (4-6 sentences) summarizing the overall 5D pattern for this scope and filter: ${filterSummary || '(no extra filter)'}.",
  "strengths": ["Strength 1 based on evidence", "Strength 2..."],
  "weaknesses": ["Area for improvement 1", "Area for improvement 2..."],
  "nextSteps": ["Actionable recommendation 1 for the teacher", "Recommendation 2..."]
}
Be specific to the numbers; avoid generic filler.`;

    const systemPrompt = `${roleLine}
Dimensions: vision, values, thinking, connection, action. Scores are on a 0–10 scale (aggregated means). The JSON scores and filter are authoritative for magnitudes; supporting prose is for grounding only.
${evidenceBlock}
${langLine}
Return ONLY valid JSON with this exact shape (no markdown):
${jsonSchema}`;

    const maxTokens = brief ? 800 : 1800;

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
      brief,
      evidenceTextLength: evidenceText.length,
      evidenceSourceCount: evidenceSourceCount ?? null,
      evidenceNearTotalCap: evidenceText.length >= EVIDENCE_MAX_TOTAL_CHARS * 0.95,
    });

    const opikThreadId = crypto.randomUUID();
    const clientTraceId = uuidv7();
    const traceStartMs = Date.now();
    const { content, usage } = await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: userContent }],
      0.4,
      maxTokens,
      'fast',
      false,
      'json_object',
    ) as { content: string; usage?: unknown };
    const traceEndMs = Date.now();

    void queueOpikTrace({
      traceName: 'explain-analytics-5d.completion',
      tags: ['explain-analytics-5d', 'edge-function'],
      threadId: opikThreadId,
      clientTraceId,
      traceStartMs,
      traceEndMs,
      input: {
        context,
        language,
        classroom_id: classroomId || undefined,
        filter_summary: filterSummary || undefined,
        evidence_chars: evidenceText.length,
      },
      output: { raw_json: content },
      openaiUsage: usage,
      llmModel: resolveChatModel('fast'),
      metadata: {
        edge_function: 'explain-analytics-5d',
        model_tier: 'fast',
      },
    }).catch(() => undefined);

    const parsed = JSON.parse(content) as {
      explanations?: Record<string, string>;
      scopeSummary?: string;
      strengths?: string[];
      weaknesses?: string[];
      nextSteps?: string[];
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

    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.filter(s => typeof s === 'string' && s.trim()) : [];
    const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter(s => typeof s === 'string' && s.trim()) : [];
    const nextSteps = Array.isArray(parsed.nextSteps) ? parsed.nextSteps.filter(s => typeof s === 'string' && s.trim()) : [];

    return new Response(
      JSON.stringify({
        explanations,
        scopeSummary,
        strengths,
        weaknesses,
        nextSteps,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    logError('explain-analytics-5d', e);
    const message = handleOpenAIError(e);
    await persistEdgeFunctionLog(
      {
        functionName: 'explain-analytics-5d',
        level: 'error',
        httpStatus: 500,
        message,
        stack: errorToStack(e),
      },
      req,
    );
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
