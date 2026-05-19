/**
 * Suggest up to 5 (domain, skill) pairs: prefer classroom catalog, else AI-proposed custom pairs.
 * After changing prompts, deploy: `supabase functions deploy suggest-assignment-hard-skills`
 */
import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import { isAppAdmin } from '../shared/supabase.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace } from '../shared/opikTrace.ts';
import type { HardSkillPair } from '../_shared/hardSkillsFormat.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DomainRow {
  name: string;
  components: string[];
}

const ASSIGNMENT_TYPE_REFERENCE = `Assignment type reference (enum values):
- chatbot: interactive Q&A with an AI tutor
- questions: structured question set
- text_essay: written essay
- test: formal test / quiz
- project: multi-step project work
- presentation: oral/slide presentation
- langchain: workflow / chain-based activity`;

function validateSuggestions(raw: DomainRow[], suggestions: HardSkillPair[]): HardSkillPair[] {
  const domainMap = new Map<string, Set<string>>();
  for (const d of raw) {
    const name = String(d.name ?? '').trim();
    if (!name) continue;
    const comps = new Set(
      (d.components ?? []).map((c) => String(c).trim()).filter(Boolean),
    );
    domainMap.set(name, comps);
  }

  const seen = new Set<string>();
  const out: HardSkillPair[] = [];
  for (const s of suggestions) {
    const domain = String(s.domain ?? '').trim();
    const skill = String(s.skill ?? '').trim();
    if (!domain || !skill) continue;
    const comps = domainMap.get(domain);
    if (!comps || !comps.has(skill)) continue;
    const key = `${domain}\0${skill}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ domain, skill });
    if (out.length >= 5) break;
  }
  return out;
}

function parseSuggestionArray(sugg: unknown): HardSkillPair[] {
  const rawList: HardSkillPair[] = [];
  if (!Array.isArray(sugg)) return rawList;
  for (const item of sugg) {
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const domain = typeof o.domain === 'string' ? o.domain : '';
      const skill =
        typeof o.skill === 'string'
          ? o.skill
          : typeof o.skill_component === 'string'
            ? o.skill_component
            : '';
      if (domain.trim() && skill.trim()) {
        rawList.push({ domain: domain.trim(), skill: skill.trim() });
      }
    }
  }
  return rawList;
}

function normalizeCustomSuggestions(suggestions: HardSkillPair[]): HardSkillPair[] {
  const seen = new Set<string>();
  const out: HardSkillPair[] = [];
  for (const s of suggestions) {
    const domain = String(s.domain ?? '').trim();
    const skill = String(s.skill ?? '').trim();
    if (!domain || !skill) continue;
    const key = `${domain}\0${skill}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ domain, skill });
    if (out.length >= 5) break;
  }
  return out;
}

function parseSuggestionsFromContent(content: string | null | undefined): HardSkillPair[] {
  let parsed: { suggestions?: unknown } = {};
  try {
    parsed = JSON.parse(content || '{}');
  } catch {
    parsed = {};
  }
  return parseSuggestionArray(parsed.suggestions);
}

type SuggestOpikContext = {
  threadId: string;
  classroomId: string;
  assignmentType: string;
  language: 'he' | 'en';
};

async function suggestFromCatalog(
  normalizedDomains: DomainRow[],
  title: string,
  instructions: string,
  assignmentType: string,
  language: 'he' | 'en',
  opik: SuggestOpikContext | null,
): Promise<HardSkillPair[]> {
  const allowedJson = JSON.stringify(normalizedDomains);
  const langNote = language === 'he'
    ? 'The teacher UI may be in Hebrew; match skill and domain strings exactly as in ALLOWED_TABLE (including language).'
    : 'Match skill and domain strings exactly as in ALLOWED_TABLE.';

  const systemPrompt = `You are an expert curriculum designer. Pick the most relevant hard skills for an assignment from a fixed table only.

Rules:
- You MUST ONLY choose skills that appear under the correct domain in ALLOWED_TABLE. Copy domain names and skill strings EXACTLY (same spelling/characters).
- Return at most 5 items total (you may return fewer if only some skills fit). You may pick multiple skills from the same domain or spread across domains.
- Rank by relevance to the assignment title, instructions, and assignment type.
- Diversity: when two or more domains are *similarly* relevant to the assignment, prefer including skills from more than one domain (still at most 5 total). If a single domain clearly matches the instructions best, it is fine to choose most or all skills from that domain—do not add weaker skills from other domains just to diversify.
- ${langNote}
- If nothing fits, return an empty suggestions array.

Respond with JSON only, using this shape:
{"suggestions":[{"domain":"exact domain name from table","skill":"exact skill string from that domain's components"}]}

${ASSIGNMENT_TYPE_REFERENCE}`;

  const userContent = `ALLOWED_TABLE (JSON array of domains, each with name and components):
${allowedJson}

Assignment type: ${assignmentType || '(unknown)'}

Title:
${title.trim() || '(none)'}

Instructions:
${instructions.trim() || '(none)'}`;

  const traceStartMs = Date.now();
  const { content, usage } = await createChatCompletion(
    systemPrompt,
    [{ role: 'user', content: userContent }],
    0.2,
    1200,
    'fast',
    false,
    'json_object',
  ) as { content: string; usage?: unknown };
  const traceEndMs = Date.now();

  if (opik) {
    const clientTraceId = crypto.randomUUID();
    void queueOpikTrace({
      traceName: 'suggest-assignment-hard-skills.catalog',
      tags: ['suggest-assignment-hard-skills', 'edge-function'],
      threadId: opik.threadId,
      clientTraceId,
      traceStartMs,
      traceEndMs,
      input: {
        assignment_type: opik.assignmentType,
        language: opik.language,
        title,
        instructions,
        catalog_domain_count: normalizedDomains.length,
      },
      output: { response_json: content },
      openaiUsage: usage,
      metadata: {
        edge_function: 'suggest-assignment-hard-skills',
        model_tier: 'fast',
        path: 'catalog',
        classroom_id: opik.classroomId,
      },
    }).catch(() => undefined);
  }

  const rawList = parseSuggestionsFromContent(content);
  return validateSuggestions(normalizedDomains, rawList);
}

async function suggestCustom(
  title: string,
  instructions: string,
  assignmentType: string,
  language: 'he' | 'en',
  opik: SuggestOpikContext | null,
): Promise<HardSkillPair[]> {
  const langNote = language === 'he'
    ? 'Write every domain and skill string in Hebrew.'
    : 'Write every domain and skill string in English.';

  const systemPrompt = `You are an expert curriculum designer. Propose hard skills (concrete, assessable technical or domain-specific abilities) for this assignment.

Rules:
- Return at most 5 items in {"suggestions":[{"domain":"...","skill":"..."}]}. Use domain as a short subject-area label and skill as a concise skill name the teacher can assess.
- Base choices on the assignment title, instructions, and assignment type. Prefer specific skills over vague ones.
- ${langNote}
- If the assignment context is too thin to infer skills, return an empty suggestions array.

Respond with JSON only using that shape.

${ASSIGNMENT_TYPE_REFERENCE}`;

  const userContent = `Assignment type: ${assignmentType || '(unknown)'}

Title:
${title.trim() || '(none)'}

Instructions:
${instructions.trim() || '(none)'}`;

  const traceStartMs = Date.now();
  const { content, usage } = await createChatCompletion(
    systemPrompt,
    [{ role: 'user', content: userContent }],
    0.35,
    1200,
    'fast',
    false,
    'json_object',
  ) as { content: string; usage?: unknown };
  const traceEndMs = Date.now();

  if (opik) {
    const clientTraceId = crypto.randomUUID();
    void queueOpikTrace({
      traceName: 'suggest-assignment-hard-skills.custom',
      tags: ['suggest-assignment-hard-skills', 'edge-function'],
      threadId: opik.threadId,
      clientTraceId,
      traceStartMs,
      traceEndMs,
      input: {
        assignment_type: opik.assignmentType,
        language: opik.language,
        title,
        instructions,
      },
      output: { response_json: content },
      openaiUsage: usage,
      metadata: {
        edge_function: 'suggest-assignment-hard-skills',
        model_tier: 'fast',
        path: 'custom',
        classroom_id: opik.classroomId,
      },
    }).catch(() => undefined);
  }

  const rawList = parseSuggestionsFromContent(content);
  return normalizeCustomSuggestions(rawList);
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
    const instructions = typeof body.instructions === 'string' ? body.instructions : '';
    const assignmentType = typeof body.assignmentType === 'string' ? body.assignmentType : '';
    const title = typeof body.title === 'string' ? body.title : '';
    const language = body.language === 'he' ? 'he' : 'en';
    const domainsBody: DomainRow[] = Array.isArray(body.domains) ? body.domains : [];

    if (!classroomId) {
      return new Response(JSON.stringify({ error: 'classroomId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: classroom, error: classErr } = await supabase
      .from('classrooms')
      .select('teacher_id, domains')
      .eq('id', classroomId)
      .maybeSingle();

    if (classErr || !classroom) {
      return new Response(JSON.stringify({ error: 'Classroom not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if ((classroom as { teacher_id: string }).teacher_id !== user.id) {
      const admin = await isAppAdmin(user.id);
      if (!admin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const rawDomains: DomainRow[] =
      domainsBody.length > 0
        ? domainsBody
        : (((classroom as { domains?: unknown }).domains as DomainRow[]) ?? []);

    const normalizedDomains: DomainRow[] = rawDomains
      .map((d) => ({
        name: String(d?.name ?? '').trim(),
        components: Array.isArray(d?.components)
          ? d.components.map((c) => String(c).trim()).filter(Boolean)
          : [],
      }))
      .filter((d) => d.name.length > 0 && d.components.length > 0);

    const opikThreadId = crypto.randomUUID();
    const opikCtx: SuggestOpikContext = {
      threadId: opikThreadId,
      classroomId,
      assignmentType,
      language,
    };

    let suggestions: HardSkillPair[] = [];
    let source: 'catalog' | 'custom';

    if (normalizedDomains.length > 0) {
      suggestions = await suggestFromCatalog(
        normalizedDomains,
        title,
        instructions,
        assignmentType,
        language,
        opikCtx,
      );
      if (suggestions.length > 0) {
        source = 'catalog';
      } else {
        suggestions = await suggestCustom(title, instructions, assignmentType, language, opikCtx);
        source = 'custom';
      }
    } else {
      suggestions = await suggestCustom(title, instructions, assignmentType, language, opikCtx);
      source = 'custom';
    }

    return new Response(JSON.stringify({ suggestions, source }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = handleOpenAIError(e);
    await persistEdgeFunctionLog(
      {
        functionName: 'suggest-assignment-hard-skills',
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
