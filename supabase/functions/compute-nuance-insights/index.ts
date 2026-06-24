import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../shared/supabase.ts';
import { createChatCompletion, handleOpenAIError, resolveChatModel } from '../shared/openai.ts';
import { logInfo, logError } from '../shared/logger.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';
import {
  computeMetricsForAssignment,
  resolveAssignmentDurationSeconds,
  type NuanceEvent,
  type StudentMetrics,
  type SubmissionTimingRow,
} from './computeMetrics.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ───────────────────────────────────────────────────────────

interface Recommendation {
  student_id: string;
  classroom_id: string;
  recommendation_type: string;
  trigger_reason: string;
  confidence_score: number;
  recommendation_text: string;
  supporting_metrics: Record<string, unknown>;
}

interface StudentBaseline {
  avg_latency: number;
  avg_idle_ratio: number;
  avg_completion_rate: number;
  assignment_count: number;
}

// ── Baseline Computation ────────────────────────────────────────────

function computeStudentBaseline(allMetrics: StudentMetrics[]): StudentBaseline {
  if (allMetrics.length === 0) {
    return { avg_latency: 0, avg_idle_ratio: 0, avg_completion_rate: 0, assignment_count: 0 };
  }

  const latencies = allMetrics
    .map((m) => m.avg_response_latency_ms)
    .filter((v): v is number => v !== null);

  const completedCount = allMetrics.filter(
    (m) => m.completion_status === 'completed',
  ).length;

  return {
    avg_latency:
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    avg_idle_ratio:
      allMetrics.reduce((s, m) => s + m.idle_ratio, 0) / allMetrics.length,
    avg_completion_rate: allMetrics.length > 0 ? completedCount / allMetrics.length : 1,
    assignment_count: allMetrics.length,
  };
}

// ── Rule Engine ─────────────────────────────────────────────────────
// Recommendations are one per (student, classroom): rules use the tail of the student’s
// metrics in this class (e.g. last 5 activities). The teacher table may be filtered in the
// UI to a subset of activities; the flag still describes this class-wide window.

function applyRules(
  recentMetrics: StudentMetrics[],
  baseline: StudentBaseline,
  classBaseline: StudentBaseline,
): { type: string; reason: string; confidence: number; metrics: Record<string, unknown> } | null {
  if (recentMetrics.length === 0) return null;

  const candidates: {
    type: string;
    reason: string;
    confidence: number;
    metrics: Record<string, unknown>;
  }[] = [];

  const last5 = recentMetrics.slice(-5);
  const totalUnderstandingCues = last5.reduce((s, m) => s + (m.understanding_cue_count ?? 0), 0);
  const completedInLast5 = last5.filter((m) => m.completion_status === 'completed').length;
  const completionRateLast5 = last5.length > 0 ? completedInLast5 / last5.length : 1;

  // Rule 1: Engagement Support
  const highIdleSessions = last5.filter((m) => m.idle_ratio > 0.35);
  const multiSessionAssignments = last5.filter((m) => m.session_count > 2);

  if (highIdleSessions.length >= 3 || (highIdleSessions.length >= 2 && multiSessionAssignments.length >= 2)) {
    const avgIdle = last5.reduce((s, m) => s + m.idle_ratio, 0) / last5.length;
    const deviation = baseline.avg_idle_ratio > 0
      ? (avgIdle - baseline.avg_idle_ratio) / baseline.avg_idle_ratio
      : avgIdle;

    candidates.push({
      type: 'engagement_support',
      reason: `Time away from tab elevated in ${highIdleSessions.length} of last ${last5.length} sessions (avg ${(avgIdle * 100).toFixed(0)}% vs baseline ${(baseline.avg_idle_ratio * 100).toFixed(0)}%)`,
      confidence: Math.min(0.5 + deviation * 0.5, 0.95),
      metrics: {
        idle_ratio: +(avgIdle.toFixed(3)),
        baseline_idle_ratio: +(baseline.avg_idle_ratio.toFixed(3)),
        focus_loss_count: last5.reduce((s, m) => s + m.focus_loss_count, 0),
        high_idle_sessions: highIdleSessions.length,
        understanding_cue_count_recent: totalUnderstandingCues,
      },
    });
  }

  // Rule 2: Pacing Support
  const latencies = last5
    .map((m) => m.avg_response_latency_ms)
    .filter((v): v is number => v !== null);

  if (latencies.length > 0 && baseline.avg_latency > 0) {
    const recentAvgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const ratio = recentAvgLatency / baseline.avg_latency;

    const completedRecent = last5.filter((m) => m.completion_status === 'completed').length;
    const completionNormal = completedRecent / last5.length >= 0.5;

    if (ratio > 1.5 && completionNormal) {
      candidates.push({
        type: 'pacing_support',
        reason: `Response time ${ratio.toFixed(1)}x above student baseline while completion remains normal`,
        confidence: Math.min(0.4 + (ratio - 1.5) * 0.3, 0.95),
        metrics: {
          avg_response_latency_ms: Math.round(recentAvgLatency),
          baseline_latency_ms: Math.round(baseline.avg_latency),
          latency_ratio: +ratio.toFixed(2),
          completion_rate: +(completedRecent / last5.length).toFixed(2),
          understanding_cue_count_recent: totalUnderstandingCues,
        },
      });
    }
  }

  // Rule 3: Persistence Support
  const completedCount = last5.filter((m) => m.completion_status === 'completed').length;
  const completionRate = last5.length > 0 ? completedCount / last5.length : 1;

  if (completionRate < 0.65 && last5.length >= 3) {
    const baselineDrop = baseline.avg_completion_rate - completionRate;
    const cueBoost = totalUnderstandingCues >= 4 && completionRate < 0.5 ? 0.06 : 0;

    candidates.push({
      type: 'persistence_support',
      reason: `Completion rate ${(completionRate * 100).toFixed(0)}% across last ${last5.length} activities (baseline ${(baseline.avg_completion_rate * 100).toFixed(0)}%)`,
      confidence: Math.min(0.5 + baselineDrop * 0.5 + cueBoost, 0.95),
      metrics: {
        completion_rate: +completionRate.toFixed(2),
        baseline_completion_rate: +baseline.avg_completion_rate.toFixed(2),
        incomplete_count: last5.length - completedCount,
        session_count_avg: +(last5.reduce((s, m) => s + m.session_count, 0) / last5.length).toFixed(1),
        understanding_cue_count_recent: totalUnderstandingCues,
      },
    });
  }

  if (candidates.length === 0) return null;

  // Return highest confidence; drop borderline "weak amber" results
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  if (best.confidence < 0.5) return null;

  if (totalUnderstandingCues >= 3 && completionRateLast5 >= 0.5) {
    best.metrics = {
      ...best.metrics,
      scaffolding_signal: 1,
    };
  }

  return best;
}

// ── LLM Phrasing ───────────────────────────────────────────────────

async function rephraseRecommendation(
  ruleResult: { type: string; reason: string; metrics: Record<string, unknown> },
  studentName: string,
  opik: { threadId: string; classroomId: string; studentId: string },
): Promise<string> {
  const systemPrompt = `You are an educational insights assistant. Rephrase the following rule-based recommendation into 1-2 sentences of practical, teacher-friendly, non-diagnostic, action-oriented advice.

Rules:
- Do NOT diagnose the student (no "the student is anxious" or "lacks motivation")
- Be specific about what the teacher can do
- When supporting data includes numbers, mention at least one concrete value (a percentage, ratio, count, or time) in natural language
- If scaffolding_signal is present with understanding_cue_count_recent, you may note that the student may be asking for re-explanations in chat while still progressing — frame neutrally, not as a deficit
- Keep it concise (1-2 sentences max)
- Write in second person addressing the teacher

Recommendation type: ${ruleResult.type.replace(/_/g, ' ')}
Trigger: ${ruleResult.reason}
Supporting data: ${JSON.stringify(ruleResult.metrics)}
Student name: ${studentName}`;

  try {
    const traceStartMs = Date.now();
    const result = await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: 'Generate the teacher recommendation.' }],
      0.6,
      200,
      'fast',
    );
    const traceEndMs = Date.now();

    if (typeof result === 'object' && 'content' in result) {
      const r = result as { content: string; usage?: unknown };
      void queueOpikTrace({
        traceName: 'compute-nuance-insights.llm-phrasing',
        tags: ['compute-nuance-insights', 'edge-function'],
        threadId: opik.threadId,
        clientTraceId: uuidv7(),
        traceStartMs,
        traceEndMs,
        input: {
          rule_type: ruleResult.type,
          rule_reason: ruleResult.reason,
        },
        output: { recommendation_text: r.content },
        openaiUsage: r.usage,
        llmModel: resolveChatModel('fast'),
        metadata: {
          edge_function: 'compute-nuance-insights',
          model_tier: 'fast',
          classroom_id: opik.classroomId,
          student_id: opik.studentId,
        },
      }).catch(() => undefined);
      return r.content.trim();
    }
    return getFallbackText(ruleResult.type);
  } catch (err) {
    logError('LLM phrasing failed, using fallback', err);
    return getFallbackText(ruleResult.type);
  }
}

function getFallbackText(type: string): string {
  switch (type) {
    case 'engagement_support':
      return 'Break the activity into shorter checkpoints and monitor whether the student re-engages faster.';
    case 'pacing_support':
      return 'Provide more structured step-by-step guidance or more completion time for this task type.';
    case 'persistence_support':
      return 'Use smaller milestones and earlier intervention when the student starts but does not finish.';
    default:
      return 'Review the student\'s recent activity patterns and consider adjusting task structure.';
  }
}

// ── Main Handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { classroom_id, student_id, assignment_id, force_refresh } = await req.json();

    if (!classroom_id) {
      return new Response(JSON.stringify({ error: 'classroom_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createSupabaseClient();

    // Fetch all assignments in this classroom
    const { data: assignments, error: assignErr } = await supabase
      .from('assignments')
      .select('id')
      .eq('classroom_id', classroom_id);

    if (assignErr || !assignments?.length) {
      return new Response(JSON.stringify({ metrics: [], recommendations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const assignmentIds = assignments.map((a: { id: string }) => a.id);

    // Short-circuit cache only if metrics are young AND no nuance event arrived *after* the last recompute
    // (otherwise new chat activity would be missing from student_nuance_metrics until cache expires)
    if (!force_refresh) {
      const { data: cachedRow } = await supabase
        .from('student_nuance_metrics')
        .select('computed_at')
        .eq('classroom_id', classroom_id)
        .order('computed_at', { ascending: false })
        .limit(1);

      if (cachedRow?.[0]) {
        const lastMetricAt = new Date(cachedRow[0].computed_at).getTime();
        const { data: evRow } = await supabase
          .from('student_nuance_events')
          .select('created_at')
          .in('assignment_id', assignmentIds)
          .order('created_at', { ascending: false })
          .limit(1);
        const lastEventAt = evRow?.[0]?.created_at
          ? new Date(evRow[0].created_at).getTime()
          : 0;
        const age = Date.now() - lastMetricAt;
        if (age < 2 * 60 * 1000 && lastEventAt <= lastMetricAt) {
          logInfo('Returning cached nuance data', { classroom_id, age_ms: age, lastEventAt, lastMetricAt });
          return await returnCachedData(supabase, classroom_id, student_id, assignment_id);
        }
        logInfo('Skipping nuance cache (stale or new events after last recompute)', {
          classroom_id,
          lastEventAt,
          lastMetricAt,
        });
      }
    }

    // Fetch all nuance events for these assignments
    let eventsQuery = supabase
      .from('student_nuance_events')
      .select('*')
      .in('assignment_id', assignmentIds)
      .order('created_at', { ascending: true });

    if (student_id) {
      eventsQuery = eventsQuery.eq('student_id', student_id);
    }

    const { data: events, error: eventsErr } = await eventsQuery;

    if (eventsErr) {
      logError('Failed to fetch nuance events', eventsErr);
      throw new Error('Failed to fetch events');
    }

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ metrics: [], recommendations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch submission statuses and timing
    const { data: submissions } = await supabase
      .from('submissions')
      .select(
        'student_id, assignment_id, status, attempt_number, is_teacher_attempt, started_at, duration_seconds, submitted_at',
      )
      .in('assignment_id', assignmentIds);

    const submissionsByKey = new Map<string, SubmissionTimingRow[]>();
    (submissions || []).forEach((s: SubmissionTimingRow) => {
      const key = `${s.student_id}:${s.assignment_id}`;
      if (!submissionsByKey.has(key)) submissionsByKey.set(key, []);
      submissionsByKey.get(key)!.push(s);
    });

    const submissionStatusMap = new Map<string, string>();
    for (const [key, rows] of submissionsByKey) {
      const eligible = rows.filter((r) => !r.is_teacher_attempt);
      const completed = eligible.filter((r) => r.status === 'completed');
      const inProgress = eligible.filter((r) => r.status === 'in_progress');
      if (completed.length > 0) {
        submissionStatusMap.set(key, 'completed');
      } else if (inProgress.length > 0) {
        submissionStatusMap.set(key, 'in_progress');
      } else if (eligible.length > 0) {
        submissionStatusMap.set(key, eligible[0].status);
      }
    }

    const durationMap = new Map<string, number | null>();
    for (const [key, rows] of submissionsByKey) {
      durationMap.set(key, resolveAssignmentDurationSeconds(rows));
    }

    // Fetch student names
    const studentIds = [...new Set(events.map((e: NuanceEvent) => e.student_id))];
    const { data: profiles } = await supabase
      .from('student_profiles')
      .select('user_id, full_name')
      .in('user_id', studentIds);

    const nameMap = new Map<string, string>();
    (profiles || []).forEach((p: { user_id: string; full_name: string }) => {
      nameMap.set(p.user_id, p.full_name || 'Student');
    });

    // Group events by student + assignment
    const grouped = new Map<string, NuanceEvent[]>();
    for (const evt of events as NuanceEvent[]) {
      const key = `${evt.student_id}:${evt.assignment_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(evt);
    }

    // Compute metrics
    const allMetrics: StudentMetrics[] = [];
    for (const [key, evts] of grouped) {
      const status = submissionStatusMap.get(key) || 'incomplete';
      const metrics = computeMetricsForAssignment(evts, classroom_id, status);
      metrics.assignment_duration_seconds = durationMap.get(key) ?? null;
      allMetrics.push(metrics);
    }

    // Upsert metrics
    if (allMetrics.length > 0) {
      const { error: upsertErr } = await supabase
        .from('student_nuance_metrics')
        .upsert(
          allMetrics.map((m) => ({ ...m, computed_at: new Date().toISOString() })),
          { onConflict: 'student_id,assignment_id' },
        );

      if (upsertErr) logError('Failed to upsert metrics', upsertErr);
    }

    // Group metrics by student for recommendation rules
    const metricsByStudent = new Map<string, StudentMetrics[]>();
    for (const m of allMetrics) {
      if (!metricsByStudent.has(m.student_id)) metricsByStudent.set(m.student_id, []);
      metricsByStudent.get(m.student_id)!.push(m);
    }

    // Compute class baseline
    const classBaseline = computeStudentBaseline(allMetrics);

    // Generate recommendations
    const recommendations: Recommendation[] = [];

    for (const [sid, metrics] of metricsByStudent) {
      const studentBaseline = computeStudentBaseline(metrics);
      const ruleResult = applyRules(metrics, studentBaseline, classBaseline);

      if (ruleResult) {
        const studentName = nameMap.get(sid) || 'Student';
        const text = await rephraseRecommendation(ruleResult, studentName, {
          threadId: `${classroom_id}:${sid}`,
          classroomId: classroom_id,
          studentId: sid,
        });

        recommendations.push({
          student_id: sid,
          classroom_id: classroom_id,
          recommendation_type: ruleResult.type,
          trigger_reason: ruleResult.reason,
          confidence_score: +ruleResult.confidence.toFixed(2),
          recommendation_text: text,
          supporting_metrics: ruleResult.metrics,
        });
      }
    }

    // Upsert recommendations
    if (recommendations.length > 0) {
      const { error: recErr } = await supabase
        .from('student_recommendations')
        .upsert(
          recommendations.map((r) => ({ ...r, generated_at: new Date().toISOString() })),
          { onConflict: 'student_id,classroom_id' },
        );

      if (recErr) logError('Failed to upsert recommendations', recErr);
    }

    // Return results
    const response = {
      metrics: allMetrics,
      recommendations,
      baselines: {
        class: classBaseline,
      },
    };

    logInfo('Nuance insights computed', {
      classroom_id,
      metrics_count: allMetrics.length,
      recommendations_count: recommendations.length,
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in compute-nuance-insights', error);
    await persistEdgeFunctionLog(
      {
        functionName: 'compute-nuance-insights',
        level: 'error',
        httpStatus: 500,
        message: errorMessage,
        stack: errorToStack(error),
      },
      req,
    );

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Helper: return cached data from DB ──────────────────────────────

async function returnCachedData(
  supabase: ReturnType<typeof createSupabaseClient>,
  classroomId: string,
  studentId?: string,
  assignmentId?: string,
) {
  let metricsQuery = supabase
    .from('student_nuance_metrics')
    .select('*')
    .eq('classroom_id', classroomId);

  if (studentId) metricsQuery = metricsQuery.eq('student_id', studentId);
  if (assignmentId) metricsQuery = metricsQuery.eq('assignment_id', assignmentId);

  const { data: metrics } = await metricsQuery;

  let recsQuery = supabase
    .from('student_recommendations')
    .select('*')
    .eq('classroom_id', classroomId);

  if (studentId) recsQuery = recsQuery.eq('student_id', studentId);

  const { data: recommendations } = await recsQuery;

  return new Response(
    JSON.stringify({
      metrics: metrics || [],
      recommendations: recommendations || [],
      baselines: { class: computeStudentBaseline(metrics || []) },
      cached: true,
    }),
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Content-Type': 'application/json',
      },
    },
  );
}
