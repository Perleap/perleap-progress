/**
 * Classroom evaluation refresh job: eligibility, compute-by-student, commit-at-end.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getAssignmentModuleActivityContextText } from '../shared/supabase.ts';
import { logInfo, logError } from '../shared/logger.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';
import { parseHardSkillsFromDb, type HardSkillPair } from './hardSkillsFormat.ts';
import {
  buildStudentWorkContext,
  detectLanguageFromText,
} from './evaluationContext.ts';
import { runEvaluation, seedFromSubmissionId, type EvaluationResult } from './evaluation.ts';
import { persistAiEvaluation } from './evaluationPersist.ts';
import {
  buildSubmissionBackup,
  restoreSubmissionBackup,
  type SubmissionEvaluationBackup,
} from './evaluationRefreshBackup.ts';
import { runPool } from './asyncPool.ts';

export type SupabaseClient = ReturnType<typeof createClient>;

export type RefreshJobStatus = 'running' | 'cancelled' | 'completed' | 'failed';

export type SubmissionRow = {
  id: string;
  student_id: string;
  assignment_id: string;
};

export type EligibilityResult = {
  eligible: SubmissionRow[];
  manualSkipped: number;
  skippedNoFeedback: number;
};

type AssignmentCacheRow = {
  id: string;
  classroom_id: string;
  title: string | null;
  instructions: string | null;
  hard_skills: unknown;
  hard_skill_domain: string | null;
  type: string | null;
  auto_publish_ai_feedback: boolean | null;
};

type RefreshCaches = {
  assignmentsById: Map<string, AssignmentCacheRow>;
  studentNames: Map<string, string>;
  teacherByAssignment: Map<string, string>;
  moduleContextByAssignment: Map<string, string>;
};

export type ComputedEvaluation = {
  sub: SubmissionRow;
  evaluation: EvaluationResult;
  skillPairs: HardSkillPair[];
  hardSkillDomain: string | null;
  visibleToStudent: boolean;
  opikTraceIds: { feedback_main: string; hard_skills: string };
  classroomId: string;
};

export const REFRESH_CONCURRENCY = Math.min(
  5,
  Math.max(1, parseInt(Deno.env.get('REFRESH_EVAL_CONCURRENCY') ?? '4', 10) || 4),
);

export async function loadEligibleSubmissions(
  supabase: SupabaseClient,
  classroomId: string,
): Promise<EligibilityResult | null> {
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id')
    .eq('classroom_id', classroomId);

  if (!assignments?.length) return null;

  const assignmentIds = assignments.map((a) => a.id);

  const { data: submissions } = await supabase
    .from('submissions')
    .select('id, student_id, assignment_id')
    .in('assignment_id', assignmentIds);

  if (!submissions?.length) return null;

  const submissionIds = submissions.map((s) => s.id);

  const { data: feedbackRows } = await supabase
    .from('assignment_feedback')
    .select('submission_id, evaluation_source')
    .in('submission_id', submissionIds);

  const feedbackBySubmission = new Map(
    (feedbackRows ?? []).map((f) => [f.submission_id, f.evaluation_source]),
  );

  const eligible = submissions.filter((s) => {
    const source = feedbackBySubmission.get(s.id);
    return source !== undefined && source !== 'teacher_manual';
  });

  const manualSkipped = submissions.filter(
    (s) => feedbackBySubmission.get(s.id) === 'teacher_manual',
  ).length;

  const skippedNoFeedback = submissions.length - (feedbackRows?.length ?? 0);

  return { eligible, manualSkipped, skippedNoFeedback };
}

export function groupSubmissionsByStudent(
  eligible: SubmissionRow[],
): Map<string, SubmissionRow[]> {
  const groups = new Map<string, SubmissionRow[]>();
  for (const sub of eligible) {
    const list = groups.get(sub.student_id) ?? [];
    list.push(sub);
    groups.set(sub.student_id, list);
  }
  return groups;
}

export async function getRunningJobForClassroom(
  supabase: SupabaseClient,
  classroomId: string,
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from('evaluation_refresh_jobs')
    .select('id')
    .eq('classroom_id', classroomId)
    .eq('status', 'running')
    .maybeSingle();
  return data ?? null;
}

async function buildRefreshCaches(
  supabase: SupabaseClient,
  eligible: SubmissionRow[],
): Promise<RefreshCaches> {
  const uniqueAssignmentIds = [...new Set(eligible.map((s) => s.assignment_id))];
  const uniqueStudentIds = [...new Set(eligible.map((s) => s.student_id))];

  const [{ data: assignmentRows }, { data: studentProfiles }, { data: assignmentsWithTeacher }] =
    await Promise.all([
      supabase
        .from('assignments')
        .select(
          'id, classroom_id, title, instructions, hard_skills, hard_skill_domain, type, auto_publish_ai_feedback',
        )
        .in('id', uniqueAssignmentIds),
      supabase.from('student_profiles').select('user_id, full_name').in('user_id', uniqueStudentIds),
      supabase.from('assignments').select('id, classrooms(teacher_id)').in('id', uniqueAssignmentIds),
    ]);

  const assignmentsById = new Map(
    (assignmentRows ?? []).map((row) => [row.id as string, row as AssignmentCacheRow]),
  );

  const studentNames = new Map<string, string>(
    (studentProfiles ?? []).map((p) => [
      p.user_id as string,
      (p.full_name as string | null) || 'the student',
    ]),
  );
  for (const studentId of uniqueStudentIds) {
    if (!studentNames.has(studentId)) {
      studentNames.set(studentId, 'the student');
    }
  }

  const teacherIds = [
    ...new Set(
      (assignmentsWithTeacher ?? [])
        .map((a) => (a.classrooms as { teacher_id?: string } | null)?.teacher_id)
        .filter((id): id is string => !!id),
    ),
  ];

  const { data: teacherProfiles } = teacherIds.length
    ? await supabase.from('teacher_profiles').select('user_id, full_name').in('user_id', teacherIds)
    : { data: [] as { user_id: string; full_name: string | null }[] };

  const teacherNameByUserId = new Map(
    (teacherProfiles ?? []).map((p) => [
      p.user_id as string,
      (p.full_name as string | null) || 'your teacher',
    ]),
  );

  const teacherByAssignment = new Map<string, string>();
  for (const row of assignmentsWithTeacher ?? []) {
    const teacherId = (row.classrooms as { teacher_id?: string } | null)?.teacher_id;
    teacherByAssignment.set(
      row.id as string,
      teacherId ? teacherNameByUserId.get(teacherId) ?? 'your teacher' : 'your teacher',
    );
  }

  const moduleContextByAssignment = new Map<string, string>();
  await Promise.all(
    uniqueAssignmentIds.map(async (assignmentId) => {
      const text = await getAssignmentModuleActivityContextText(assignmentId);
      moduleContextByAssignment.set(assignmentId, text);
    }),
  );

  return {
    assignmentsById,
    studentNames,
    teacherByAssignment,
    moduleContextByAssignment,
  };
}

async function computeOneSubmission(
  supabase: SupabaseClient,
  sub: SubmissionRow,
  caches: RefreshCaches,
  classroomId: string,
): Promise<ComputedEvaluation | null> {
  try {
    const assignmentData = caches.assignmentsById.get(sub.assignment_id);
    if (!assignmentData) {
      throw new Error(`Assignment ${sub.assignment_id} not found`);
    }

    const assignmentType = assignmentData.type;
    const classroomIdFromAssignment = assignmentData.classroom_id;
    const studentName = caches.studentNames.get(sub.student_id) ?? 'the student';
    const teacherName = caches.teacherByAssignment.get(sub.assignment_id) ?? 'your teacher';
    const moduleActivityContextText =
      caches.moduleContextByAssignment.get(sub.assignment_id) ?? '';

    const workContext = await buildStudentWorkContext(
      supabase,
      sub.id,
      sub.assignment_id,
      assignmentType,
    );

    const detectedLanguage = detectLanguageFromText(workContext.studentWorkText);
    const skillPairs = parseHardSkillsFromDb(
      assignmentData.hard_skills,
      assignmentData.hard_skill_domain,
    );

    const feedbackTraceId = uuidv7();
    const hardSkillsTraceId = uuidv7();
    const opikThreadId = sub.id;

    const evaluation = await runEvaluation(
      {
        language: detectedLanguage,
        studentName,
        teacherName,
        assignmentTitle: assignmentData.title || '',
        assignmentType: assignmentType || 'questions',
        assignmentInstructions: assignmentData.instructions || '',
        moduleActivityContextText,
        studentWorkText: workContext.studentWorkText,
        mode: 'student_work',
        skillPairs,
        hardSkillDomain: assignmentData.hard_skill_domain,
        seed: seedFromSubmissionId(sub.id),
      },
      {
        onMainTrace: (t) => {
          void queueOpikTrace({
            traceName: 'refresh-class-evaluations.main',
            tags: ['refresh-class-evaluations', 'edge-function'],
            threadId: opikThreadId,
            clientTraceId: feedbackTraceId,
            traceStartMs: t.traceStartMs,
            traceEndMs: t.traceEndMs,
            input: t.input,
            output: t.output,
            openaiUsage: t.usage,
            llmModel: t.model,
            metadata: {
              edge_function: 'refresh-class-evaluations',
              submission_id: sub.id,
              classroom_id: classroomId,
            },
          }).catch(() => undefined);
        },
        onHardSkillsTrace: (t) => {
          void queueOpikTrace({
            traceName: 'refresh-class-evaluations.hard-skills',
            tags: ['refresh-class-evaluations', 'edge-function'],
            threadId: opikThreadId,
            clientTraceId: hardSkillsTraceId,
            traceStartMs: t.traceStartMs,
            traceEndMs: t.traceEndMs,
            input: t.input,
            output: t.output,
            openaiUsage: t.usage,
            llmModel: t.model,
            metadata: {
              edge_function: 'refresh-class-evaluations',
              submission_id: sub.id,
              classroom_id: classroomId,
            },
          }).catch(() => undefined);
        },
      },
    );

    const { data: existingFb } = await supabase
      .from('assignment_feedback')
      .select('visible_to_student')
      .eq('submission_id', sub.id)
      .maybeSingle();

    return {
      sub,
      evaluation,
      skillPairs,
      hardSkillDomain: assignmentData.hard_skill_domain,
      visibleToStudent: existingFb?.visible_to_student ?? true,
      opikTraceIds: {
        feedback_main: feedbackTraceId,
        hard_skills: hardSkillsTraceId,
      },
      classroomId: classroomIdFromAssignment,
    };
  } catch (e) {
    logError(`Refresh compute failed for submission ${sub.id}`, e);
    return null;
  }
}

export async function isJobCancelled(
  supabase: SupabaseClient,
  jobId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('evaluation_refresh_jobs')
    .select('status')
    .eq('id', jobId)
    .maybeSingle();
  return data?.status === 'cancelled';
}

async function deleteBackupBatch(
  supabase: SupabaseClient,
  batchId: string | null,
): Promise<void> {
  if (!batchId) return;
  await supabase.from('evaluation_refresh_batches').delete().eq('id', batchId);
}

async function finalizeJob(
  supabase: SupabaseClient,
  jobId: string,
  status: RefreshJobStatus,
  errorMessage?: string,
): Promise<void> {
  await supabase
    .from('evaluation_refresh_jobs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .eq('id', jobId);
}

async function restoreAllBackups(
  supabase: SupabaseClient,
  backups: SubmissionEvaluationBackup[],
): Promise<void> {
  for (const backup of backups) {
    try {
      await restoreSubmissionBackup(supabase, backup);
    } catch (e) {
      logError(`Auto-restore failed for submission ${backup.submission_id}`, e);
    }
  }
}

async function commitAllEvaluations(
  supabase: SupabaseClient,
  computed: ComputedEvaluation[],
): Promise<boolean> {
  for (const item of computed) {
    try {
      await persistAiEvaluation(supabase, {
        submissionId: item.sub.id,
        studentId: item.sub.student_id,
        assignmentId: item.sub.assignment_id,
        classroomId: item.classroomId,
        scores: item.evaluation.scores,
        scoreExplanations: item.evaluation.scoreExplanations,
        qedMeasures: item.evaluation.qedMeasures,
        studentFeedback: item.evaluation.studentFeedback,
        teacherFeedback: item.evaluation.teacherFeedback,
        hardSkillsAssessment: item.evaluation.hardSkillsAssessment,
        skillPairs: item.skillPairs,
        hardSkillDomain: item.hardSkillDomain,
        evaluationSource: 'ai_student_work',
        opikTraceIds: item.opikTraceIds,
        visibleToStudent: item.visibleToStudent,
      });
    } catch (e) {
      logError(`Refresh commit failed for submission ${item.sub.id}`, e);
      return false;
    }
  }
  return true;
}

export async function runRefreshJob(
  supabase: SupabaseClient,
  jobId: string,
  classroomId: string,
  eligible: SubmissionRow[],
  backups: SubmissionEvaluationBackup[],
  batchId: string,
): Promise<void> {
  try {
    const caches = await buildRefreshCaches(supabase, eligible);
    const studentGroups = groupSubmissionsByStudent(eligible);
    const studentIds = [...studentGroups.keys()];
    const allComputed: ComputedEvaluation[] = [];

    type StudentWorkerResult =
      | { ok: true; results: ComputedEvaluation[] }
      | { ok: false; reason: 'cancelled' | 'failed' };

    const workerResults = await runPool(
      studentIds,
      REFRESH_CONCURRENCY,
      async (studentId): Promise<StudentWorkerResult> => {
        if (await isJobCancelled(supabase, jobId)) {
          return { ok: false, reason: 'cancelled' };
        }

        const subs = studentGroups.get(studentId) ?? [];
        const studentResults: ComputedEvaluation[] = [];

        for (const sub of subs) {
          if (await isJobCancelled(supabase, jobId)) {
            return { ok: false, reason: 'cancelled' };
          }
          const computed = await computeOneSubmission(supabase, sub, caches, classroomId);
          if (!computed) {
            return { ok: false, reason: 'failed' };
          }
          studentResults.push(computed);
        }

        await supabase.rpc('increment_evaluation_refresh_completed_students', {
          p_job_id: jobId,
        });

        return { ok: true, results: studentResults };
      },
    );

    for (const result of workerResults) {
      if (!result.ok) {
        await deleteBackupBatch(supabase, batchId);
        await finalizeJob(
          supabase,
          jobId,
          result.reason === 'cancelled' ? 'cancelled' : 'failed',
          result.reason === 'cancelled' ? 'Cancelled by user' : 'Evaluation compute failed',
        );
        logInfo('Classroom evaluation refresh aborted (compute phase)', {
          classroomId,
          jobId,
          reason: result.reason,
        });
        return;
      }
      allComputed.push(...result.results);
    }

    if (await isJobCancelled(supabase, jobId)) {
      await deleteBackupBatch(supabase, batchId);
      await finalizeJob(supabase, jobId, 'cancelled', 'Cancelled by user');
      return;
    }

    const committed = await commitAllEvaluations(supabase, allComputed);
    if (!committed) {
      await restoreAllBackups(supabase, backups);
      await deleteBackupBatch(supabase, batchId);
      await finalizeJob(supabase, jobId, 'failed', 'Failed to save evaluations');
      return;
    }

    await finalizeJob(supabase, jobId, 'completed');
    logInfo('Classroom evaluation refresh complete', {
      classroomId,
      jobId,
      updated: allComputed.length,
      students: studentIds.length,
    });
  } catch (e) {
    logError('Refresh job worker error', e);
    await restoreAllBackups(supabase, backups);
    await deleteBackupBatch(supabase, batchId);
    await finalizeJob(
      supabase,
      jobId,
      'failed',
      e instanceof Error ? e.message : 'Unexpected error',
    );
  }
}

export async function prepareRefreshJob(
  supabase: SupabaseClient,
  classroomId: string,
  userId: string,
  eligible: SubmissionRow[],
): Promise<{
  jobId: string;
  batchId: string;
  totalStudents: number;
  totalSubmissions: number;
  backups: SubmissionEvaluationBackup[];
}> {
  const studentGroups = groupSubmissionsByStudent(eligible);
  const totalStudents = studentGroups.size;
  const totalSubmissions = eligible.length;

  const backups: SubmissionEvaluationBackup[] = await Promise.all(
    eligible.map((s) => buildSubmissionBackup(supabase, s.id, s.student_id, s.assignment_id)),
  );

  await supabase.from('evaluation_refresh_batches').delete().eq('classroom_id', classroomId);

  const { data: batchRow, error: batchErr } = await supabase
    .from('evaluation_refresh_batches')
    .insert({
      classroom_id: classroomId,
      created_by: userId,
      backups,
    })
    .select('id')
    .single();

  if (batchErr || !batchRow) {
    throw batchErr ?? new Error('Failed to save backup batch');
  }

  const { data: jobRow, error: jobErr } = await supabase
    .from('evaluation_refresh_jobs')
    .insert({
      classroom_id: classroomId,
      created_by: userId,
      status: 'running',
      total_students: totalStudents,
      completed_students: 0,
      total_submissions: totalSubmissions,
      batch_id: batchRow.id,
    })
    .select('id')
    .single();

  if (jobErr || !jobRow) {
    await supabase.from('evaluation_refresh_batches').delete().eq('id', batchRow.id);
    throw jobErr ?? new Error('Failed to create refresh job');
  }

  return {
    jobId: jobRow.id,
    batchId: batchRow.id,
    totalStudents,
    totalSubmissions,
    backups,
  };
}

export async function cancelRefreshJob(
  supabase: SupabaseClient,
  jobId: string,
  classroomId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('evaluation_refresh_jobs')
    .update({ status: 'cancelled' })
    .eq('id', jobId)
    .eq('classroom_id', classroomId)
    .eq('status', 'running')
    .select('id')
    .maybeSingle();

  if (error) {
    logError('Error cancelling refresh job', error);
    throw error;
  }

  return !!data?.id;
}
