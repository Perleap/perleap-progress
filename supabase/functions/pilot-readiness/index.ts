/**
 * AI builder-readiness assessment for the INSAIT Pilot Report.
 *
 * Two modes:
 * - `participant`: scores one participant on five builder dimensions and returns a
 *   structured decision row (readiness, role fit, strength, risk, next action, confidence).
 * - `cohort`: turns cohort aggregates into a management recommendation + three findings.
 *
 * After changing this function, redeploy: `npx supabase functions deploy pilot-readiness`
 */
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

const PILOT_DIMENSIONS = [
  'builderExecution',
  'conceptualFluency',
  'platformFit',
  'debuggingIndependence',
  'communication',
] as const;

const READINESS_LABELS = ['ready', 'coach', 'redirect', 'not_ready'] as const;
const ROLE_FIT_LABELS = ['builder', 'analyst', 'champion', 'enablement', 'training'] as const;
const CONFIDENCE_LABELS = ['high', 'medium', 'low'] as const;

type PilotDimension = (typeof PILOT_DIMENSIONS)[number];

function clamp0to100(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampPriority(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function pickEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

function cleanSentence(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseWhyBullets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => (s as string).trim())
    .slice(0, 3);
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
    const mode = body.mode as string;

    if (!classroomId) {
      return new Response(JSON.stringify({ error: 'classroomId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (mode !== 'participant' && mode !== 'cohort') {
      return new Response(JSON.stringify({ error: 'Invalid mode' }), {
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

    let systemPrompt = '';
    let userContent = '';

    if (mode === 'participant') {
      const participantName =
        typeof body.participantName === 'string' && body.participantName.trim()
          ? body.participantName.trim()
          : 'Participant';
      const fiveDScores = body.fiveDScores != null ? JSON.stringify(body.fiveDScores) : 'not available';
      const completionSummary =
        typeof body.completionSummary === 'string' && body.completionSummary.trim()
          ? body.completionSummary.trim()
          : 'not available';
      const hardSkillsSummary =
        typeof body.hardSkillsSummary === 'string' && body.hardSkillsSummary.trim()
          ? body.hardSkillsSummary.trim()
          : 'not available';
      const evidenceText =
        typeof body.evidenceText === 'string' && body.evidenceText.trim()
          ? body.evidenceText.trim()
          : '';

      systemPrompt = `You assess one pilot-program participant's readiness to work as a hands-on AI-solution builder, based ONLY on observed learning evidence from their coursework (assignment completion, AI feedback excerpts, soft-skill snapshots, hard-skill assessments). This feeds a management decision report, not a course grade.

Score five builder dimensions on a 0-100 scale:
- builderExecution: can they produce a working build? (evidence: completion of hands-on assignments, hard-skill levels)
- conceptualFluency: can they explain concepts and architecture behind what they built?
- platformFit: can they operate effectively inside a platform/tool context and connect it to real needs?
- debuggingIndependence: what happens when they get stuck — do they recover with reasonable independence?
- communication: can they explain choices, assumptions, and limitations clearly?

Then decide readiness using this weighting as a guide: builderExecution 30%, platformFit 25%, debuggingIndependence 20%, conceptualFluency 15%, communication 10%.

Readiness labels (use exactly one):
- "ready": can move into supervised real implementation work now.
- "coach": has potential but needs targeted practice before real work.
- "redirect": not ideal as a hands-on builder, but may fit another role.
- "not_ready": should not continue into platform implementation yet.

Role-fit labels (use exactly one): "builder" (builder/implementer), "analyst" (solution analyst), "champion" (platform champion), "enablement" (customer enablement/support), "training" (needs further training first).

Confidence reflects evidence quality: "high" only with rich evidence across several assignments; "medium" with partial evidence; "low" with thin or missing evidence. If evidence is thin, lower confidence rather than guessing high scores. Never invent evidence.

Also assign placementPriority: integer 1-10 for how urgently you would assign this person to supervised real builder work, based ONLY on their observed evidence and answers. 10 = top pick now; 1 = not suitable yet. Should align with readiness but can differentiate within the same readiness tier (e.g. two "coach" participants may be 6 vs 8). Low completion must lower urgency: if fewer than half of scoped assignments are completed, placementPriority should rarely exceed 5; supervised real work requires enough hands-on evidence.
${langLine}
Return ONLY valid JSON with this exact shape (no markdown):
{
  "dimensions": { "builderExecution": 0, "conceptualFluency": 0, "platformFit": 0, "debuggingIndependence": 0, "communication": 0 },
  "readiness": "ready" | "coach" | "redirect" | "not_ready",
  "roleFit": "builder" | "analyst" | "champion" | "enablement" | "training",
  "keyStrength": "one specific sentence grounded in evidence",
  "mainRisk": "one specific sentence grounded in evidence",
  "nextAction": "one concrete, assignable next step for management",
  "confidence": "high" | "medium" | "low",
  "placementPriority": 1,
  "whyBullets": ["2-3 short bullets, each one sentence, citing specific observed evidence for this decision"]
}`;

      userContent = `Participant: ${participantName}
Soft-skill (5D) mean scores 0-10 (vision/values/thinking/connection/action): ${fiveDScores}
Completion summary: ${completionSummary}
Hard-skills summary: ${hardSkillsSummary}${
        evidenceText
          ? `

## Evidence excerpts (AI feedback and per-dimension notes; may be partial)
${evidenceText}`
          : `

No text evidence available; rely on the numeric summaries and lower the confidence accordingly.`
      }`;
    } else {
      const participantCount = clamp0to100(body.participantCount);
      const readinessCounts = body.readinessCounts != null ? JSON.stringify(body.readinessCounts) : '{}';
      const meanDimensions = body.meanDimensions != null ? JSON.stringify(body.meanDimensions) : '{}';
      const roleFitCounts = body.roleFitCounts != null ? JSON.stringify(body.roleFitCounts) : '{}';

      systemPrompt = `You summarize the outcome of a builder-readiness pilot cohort for company management. You receive aggregate counts and mean dimension scores (0-100). Produce a short, decisive summary that helps management decide what to do next. Do not mention individual participants. Do not invent numbers that are not in the input.
${langLine}
Return ONLY valid JSON with this exact shape (no markdown):
{
  "recommendation": "3-5 line management recommendation paragraph stating how many participants to move into a supervised builder track, how many to place in support/enablement-oriented roles, and how many need targeted training first, based strictly on the provided counts.",
  "strongestCapability": "one sentence naming the strongest observed cohort capability",
  "mainGap": "one sentence naming the main cohort capability gap",
  "topNextAction": "one sentence with the single most important next action for the organization"
}`;

      userContent = `Participants assessed: ${participantCount}
Readiness counts: ${readinessCounts}
Role-fit counts: ${roleFitCounts}
Cohort mean dimension scores (0-100): ${meanDimensions}`;
    }

    logInfo('pilot-readiness', { mode, classroomId, language });

    const opikThreadId = crypto.randomUUID();
    const clientTraceId = uuidv7();
    const traceStartMs = Date.now();
    const { content, usage } = (await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: userContent }],
      0.3,
      1200,
      'fast',
      false,
      'json_object',
    )) as { content: string; usage?: unknown };
    const traceEndMs = Date.now();

    void queueOpikTrace({
      traceName: 'pilot-readiness.completion',
      tags: ['pilot-readiness', 'edge-function'],
      threadId: opikThreadId,
      clientTraceId,
      traceStartMs,
      traceEndMs,
      input: { mode, language, classroom_id: classroomId },
      output: { raw_json: content },
      openaiUsage: usage,
      llmModel: resolveChatModel('fast'),
      metadata: { edge_function: 'pilot-readiness', model_tier: 'fast' },
    }).catch(() => undefined);

    const parsed = JSON.parse(content) as Record<string, unknown>;

    if (mode === 'participant') {
      const rawDims = (parsed.dimensions ?? {}) as Record<string, unknown>;
      const dimensions = {} as Record<PilotDimension, number>;
      for (const dim of PILOT_DIMENSIONS) {
        dimensions[dim] = clamp0to100(rawDims[dim]);
      }

      return new Response(
        JSON.stringify({
          dimensions,
          readiness: pickEnum(parsed.readiness, READINESS_LABELS, 'not_ready'),
          roleFit: pickEnum(parsed.roleFit, ROLE_FIT_LABELS, 'training'),
          keyStrength: cleanSentence(parsed.keyStrength, ''),
          mainRisk: cleanSentence(parsed.mainRisk, ''),
          nextAction: cleanSentence(parsed.nextAction, ''),
          confidence: pickEnum(parsed.confidence, CONFIDENCE_LABELS, 'low'),
          placementPriority: clampPriority(parsed.placementPriority),
          whyBullets: parseWhyBullets(parsed.whyBullets),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        recommendation: cleanSentence(parsed.recommendation, ''),
        strongestCapability: cleanSentence(parsed.strongestCapability, ''),
        mainGap: cleanSentence(parsed.mainGap, ''),
        topNextAction: cleanSentence(parsed.topNextAction, ''),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    logError('pilot-readiness', e);
    const message = handleOpenAIError(e);
    await persistEdgeFunctionLog(
      {
        functionName: 'pilot-readiness',
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
