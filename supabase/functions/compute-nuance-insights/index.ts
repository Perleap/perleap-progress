import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../shared/supabase.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import { logInfo, logError } from '../shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Types ───────────────────────────────────────────────────────────

interface NuanceEvent {
  id: string;
  student_id: string;
  assignment_id: string;
  submission_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface StudentMetrics {
  student_id: string;
  assignment_id: string;
  classroom_id: string;
  avg_response_latency_ms: number | null;
  total_idle_time_ms: number;
  idle_ratio: number;
  completion_status: string;
  focus_loss_count: number;
  resume_count: number;
  session_count: number;
  total_session_duration_ms: number;
  first_interaction_latency_ms: number | null;
}

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

// ── Metric Computation ──────────────────────────────────────────────

function computeMetricsForAssignment(
  events: NuanceEvent[],
  classroomId: string,
  submissionStatus: string,
): StudentMetrics {
  const studentId = events[0].student_id;
  const assignmentId = events[0].assignment_id;

  const responseTimes: number[] = [];
  let totalIdleMs = 0;
  let focusLossCount = 0;
  let resumeCount = 0;
  let sessionCount = 0;
  let totalSessionMs = 0;
  let firstInteractionMs: number | null = null;

  let activityOpenedAt: number | null = null;
  let lastSessionStart: number | null = null;
  let lastBlurAt: number | null = null;

  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const evt of sorted) {
    const ts = new Date(evt.created_at).getTime();

    switch (evt.event_type) {
      case 'activity_opened':
        if (activityOpenedAt === null) activityOpenedAt = ts;
        break;

      case 'session_started':
        sessionCount++;
        lastSessionStart = ts;
        break;

      case 'session_ended':
        if (lastSessionStart !== null) {
          totalSessionMs += ts - lastSessionStart;
          lastSessionStart = null;
        }
        break;

      case 'page_blur':
        focusLossCount++;
        lastBlurAt = ts;
        break;

      case 'page_focus':
        resumeCount++;
        if (lastBlurAt !== null) {
          totalIdleMs += ts - lastBlurAt;
          lastBlurAt = null;
        }
        break;

      case 'response_submitted': {
        const rt = evt.metadata?.response_time_ms;
        if (typeof rt === 'number' && rt > 0) {
          responseTimes.push(rt);
        }
        if (firstInteractionMs === null && activityOpenedAt !== null) {
          firstInteractionMs = ts - activityOpenedAt;
        }
        break;
      }
    }
  }

  // If session was never explicitly ended, estimate from last event
  if (lastSessionStart !== null) {
    const lastEventTs = new Date(sorted[sorted.length - 1].created_at).getTime();
    totalSessionMs += lastEventTs - lastSessionStart;
  }

  const avgLatency =
    responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : null;

  const idleRatio = totalSessionMs > 0 ? totalIdleMs / totalSessionMs : 0;

  return {
    student_id: studentId,
    assignment_id: assignmentId,
    classroom_id: classroomId,
    avg_response_latency_ms: avgLatency,
    total_idle_time_ms: totalIdleMs,
    idle_ratio: Math.min(idleRatio, 1),
    completion_status: submissionStatus,
    focus_loss_count: focusLossCount,
    resume_count: resumeCount,
    session_count: Math.max(sessionCount, 1),
    total_session_duration_ms: totalSessionMs,
    first_interaction_latency_ms: firstInteractionMs,
  };
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
      reason: `Idle ratio elevated in ${highIdleSessions.length} of last ${last5.length} sessions (avg ${(avgIdle * 100).toFixed(0)}% vs baseline ${(baseline.avg_idle_ratio * 100).toFixed(0)}%)`,
      confidence: Math.min(0.5 + deviation * 0.5, 0.95),
      metrics: {
        idle_ratio: +(avgIdle.toFixed(3)),
        baseline_idle_ratio: +(baseline.avg_idle_ratio.toFixed(3)),
        focus_loss_count: last5.reduce((s, m) => s + m.focus_loss_count, 0),
        high_idle_sessions: highIdleSessions.length,
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
        },
      });
    }
  }

  // Rule 3: Persistence Support
  const completedCount = last5.filter((m) => m.completion_status === 'completed').length;
  const completionRate = last5.length > 0 ? completedCount / last5.length : 1;

  if (completionRate < 0.7 && last5.length >= 3) {
    const baselineDrop = baseline.avg_completion_rate - completionRate;

    candidates.push({
      type: 'persistence_support',
      reason: `Completion rate ${(completionRate * 100).toFixed(0)}% across last ${last5.length} activities (baseline ${(baseline.avg_completion_rate * 100).toFixed(0)}%)`,
      confidence: Math.min(0.5 + baselineDrop * 0.5, 0.95),
      metrics: {
        completion_rate: +completionRate.toFixed(2),
        baseline_completion_rate: +baseline.avg_completion_rate.toFixed(2),
        incomplete_count: last5.length - completedCount,
        session_count_avg: +(last5.reduce((s, m) => s + m.session_count, 0) / last5.length).toFixed(1),
      },
    });
  }

  if (candidates.length === 0) return null;

  // Return highest confidence
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates[0];
}

// ── LLM Phrasing ───────────────────────────────────────────────────

async function rephraseRecommendation(
  ruleResult: { type: string; reason: string; metrics: Record<string, unknown> },
  studentName: string,
): Promise<string> {
  const systemPrompt = `You are an educational insights assistant. Rephrase the following rule-based recommendation into 1-2 sentences of practical, teacher-friendly, non-diagnostic, action-oriented advice.

Rules:
- Do NOT diagnose the student (no "the student is anxious" or "lacks motivation")
- Be specific about what the teacher can do
- Keep it concise (1-2 sentences max)
- Write in second person addressing the teacher

Recommendation type: ${ruleResult.type.replace(/_/g, ' ')}
Trigger: ${ruleResult.reason}
Supporting data: ${JSON.stringify(ruleResult.metrics)}
Student name: ${studentName}`;

  try {
    const result = await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: 'Generate the teacher recommendation.' }],
      0.6,
      200,
      'fast',
    );

    if (typeof result === 'object' && 'content' in result) {
      return (result as { content: string }).content.trim();
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

    // Check cache unless force refresh
    if (!force_refresh) {
      const { data: cachedMetrics } = await supabase
        .from('student_nuance_metrics')
        .select('computed_at')
        .eq('classroom_id', classroom_id)
        .order('computed_at', { ascending: false })
        .limit(1);

      if (cachedMetrics && cachedMetrics.length > 0) {
        const age = Date.now() - new Date(cachedMetrics[0].computed_at).getTime();
        if (age < 2 * 60 * 1000) {
          logInfo('Returning cached nuance data', { classroom_id, age_ms: age });
          return await returnCachedData(supabase, classroom_id, student_id, assignment_id);
        }
      }
    }

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

    // Fetch submission statuses
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, student_id, assignment_id, status')
      .in('assignment_id', assignmentIds);

    const submissionMap = new Map<string, string>();
    (submissions || []).forEach((s: { student_id: string; assignment_id: string; status: string }) => {
      submissionMap.set(`${s.student_id}:${s.assignment_id}`, s.status);
    });

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
      const [sid, aid] = key.split(':');
      const status = submissionMap.get(key) || 'incomplete';
      const metrics = computeMetricsForAssignment(evts, classroom_id, status);
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
        const text = await rephraseRecommendation(ruleResult, studentName);

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
