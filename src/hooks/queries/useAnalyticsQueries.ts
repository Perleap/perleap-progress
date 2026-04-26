/**
 * Analytics Query Hooks
 * React Query hooks for classroom and student analytics
 *
 * Phase 2: Time-based “trend” charts are intentionally not implemented; see
 * `src/lib/analyticsExport.ts` (ANALYTICS_TRENDS_NOT_IMPLEMENTED). Splitting this
 * query with `useQueries` remains optional if profiling shows load issues.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import {
  selectBestSubmissionIdForAggregate,
  type SubmissionAttemptForBest,
} from '@/lib/bestSubmission';
import type { SyllabusStructureType } from '@/types/syllabus';
import type { AnalyticsAssignmentRef, AnalyticsModuleRef } from '@/lib/analyticsScope';
import { parseScoreExplanations, type Analytics5dNarrativeRow } from '@/lib/analytics5dEvidence';
import { INCLUDE_TEACHER_5D_EVIDENCE } from '@/config/constants';

type SubRow = {
  id: string;
  student_id: string;
  assignment_id: string;
  status: string;
  attempt_number?: number | null;
  submitted_at?: string | null;
};

type SnapshotRow = {
  user_id: string;
  submission_id: string;
  scores: Json;
  score_explanations: Json | null;
};

function sectionLabelFor(
  syllabusSectionId: string | null,
  sectionRows: { id: string; title: string }[],
): string {
  if (syllabusSectionId == null) return 'Unplaced';
  return sectionRows.find((s) => s.id === syllabusSectionId)?.title ?? '—';
}

function bestSnapshotsForStudentPair(
  studentId: string,
  assignmentId: string,
  allSubmissions: SubRow[],
  snapshots: SnapshotRow[],
): SnapshotRow[] {
  const attempts = allSubmissions.filter((s) => s.student_id === studentId && s.assignment_id === assignmentId);
  if (attempts.length === 0) return [];
  const map = new Map<string, { scores: unknown }>();
  for (const sn of snapshots) {
    if (sn.user_id === studentId && attempts.some((a) => a.id === sn.submission_id)) {
      map.set(sn.submission_id, { scores: sn.scores });
    }
  }
  const forBest: SubmissionAttemptForBest[] = attempts.map((a) => ({
    id: a.id,
    attempt_number: a.attempt_number ?? 1,
    status: a.status as 'in_progress' | 'completed',
    submitted_at: a.submitted_at ?? null,
  }));
  const bestId = selectBestSubmissionIdForAggregate(forBest, map);
  if (!bestId) return [];
  const sn = snapshots.find((s) => s.submission_id === bestId && s.user_id === studentId);
  return sn ? [sn] : [];
}

export const analyticsKeys = {
  all: ['analytics'] as const,
  classroom: (classroomId: string) => [...analyticsKeys.all, 'classroom', classroomId] as const,
  student: (studentId: string, classroomId: string) => [...analyticsKeys.all, 'student', studentId, classroomId] as const,
};

/**
 * Hook to fetch classroom analytics data
 */
export const useClassroomAnalytics = (classroomId: string | undefined) => {
  return useQuery({
    queryKey: analyticsKeys.classroom(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');

      // 1. Fetch enrollment count
      const { count: studentCount } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('classroom_id', classroomId);

      // 2. Syllabus + sections (for module filter)
      const { data: syllabusRow } = await supabase
        .from('syllabi')
        .select('id, structure_type')
        .eq('classroom_id', classroomId)
        .maybeSingle();

      const structureType = (syllabusRow?.structure_type as SyllabusStructureType | undefined) ?? null;

      const { data: sectionRows } = syllabusRow
        ? await supabase
            .from('syllabus_sections')
            .select('id, title, order_index')
            .eq('syllabus_id', syllabusRow.id)
            .order('order_index', { ascending: true })
        : { data: [] as { id: string; title: string; order_index: number }[] };

      const modules: AnalyticsModuleRef[] = (sectionRows || []).map((s) => ({
        id: s.id,
        title: s.title,
        orderIndex: s.order_index,
      }));

      // 3. Fetch assignments (linked to syllabus sections when present)
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id, title, syllabus_section_id, instructions')
        .eq('classroom_id', classroomId);

      const assignmentRefs: AnalyticsAssignmentRef[] = (assignments || []).map((a) => ({
        id: a.id,
        title: a.title,
        syllabusSectionId: a.syllabus_section_id,
        instructions: a.instructions,
      }));

      // 4. Fetch enrollments with student profiles in bulk
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, student_profiles(user_id, full_name, avatar_url)')
        .eq('classroom_id', classroomId);

      const studentIds = enrollments?.map(e => e.student_id) || [];
      const profileMap = new Map(
        enrollments?.map(e => [e.student_id, (e as any).student_profiles]) || []
      );

      // 5. Fetch all submissions for these assignments
      const assignmentIds = assignments?.map(a => a.id) || [];
      const { data: allSubmissions } = await supabase
        .from('submissions')
        .select('id, student_id, assignment_id, status, attempt_number, submitted_at')
        .in('assignment_id', assignmentIds);

      const submissionIds = allSubmissions?.map(s => s.id) || [];

      // 6. Fetch 5D snapshots in bulk
      const { data: snapshots } = await supabase
        .from('five_d_snapshots')
        .select('user_id, submission_id, scores, score_explanations')
        .in('submission_id', submissionIds)
        .eq('classroom_id', classroomId)
        .neq('source', 'onboarding');

      // 7. Fetch feedback in bulk (text for 5D narrative evidence). This hook is teacher-only
      // (`ClassroomAnalytics`). `teacher_feedback` is mapped into narrative rows only when
      // INCLUDE_TEACHER_5D_EVIDENCE; build5dNarrativeEvidence caps and labels it separately.
      const { data: feedbackData } = await supabase
        .from('assignment_feedback')
        .select('submission_id, student_id, assignment_id, student_feedback, teacher_feedback')
        .in('submission_id', submissionIds);

      // 8. Fetch hard skill assessments in bulk
      const { data: hardSkills } = await supabase
        .from('hard_skill_assessments')
        .select('*')
        .in('submission_id', submissionIds);

      const subs = (allSubmissions || []) as SubRow[];
      const snapRows = (snapshots || []) as SnapshotRow[];
      const assignById = new Map(
        (assignments || []).map((a) => [a.id, a] as [string, (typeof assignments)[0]]),
      );
      const feedbackBySubmission = new Map(
        (feedbackData || []).map((f) => [f.submission_id, f] as [string, (typeof feedbackData)[0]]),
      );

      // Process data into the format needed by ClassroomAnalytics
      const processedStudents = studentIds.map((sid) => {
        const profile = profileMap.get(sid);
        const studentSubmissions = subs.filter((s) => s.student_id === sid);
        const studentFeedback = feedbackData?.filter((f) => f.student_id === sid) || [];

        const studentSnapshotsForAggregate: SnapshotRow[] = [];
        for (const aid of assignmentIds) {
          studentSnapshotsForAggregate.push(
            ...bestSnapshotsForStudentPair(sid, aid, subs, snapRows),
          );
        }

        const narrativeRows: Analytics5dNarrativeRow[] = [];
        for (const sn of studentSnapshotsForAggregate) {
          const sub = subs.find((s) => s.id === sn.submission_id);
          if (!sub) continue;
          const a = assignById.get(sub.assignment_id);
          if (!a) continue;
          const fb = feedbackBySubmission.get(sn.submission_id);
          const studentFb =
            typeof fb?.student_feedback === 'string' ? fb.student_feedback : null;
          const teacherNote =
            INCLUDE_TEACHER_5D_EVIDENCE && typeof fb?.teacher_feedback === 'string'
              ? fb.teacher_feedback
              : null;
          narrativeRows.push({
            studentId: sid,
            studentName: (profile as { full_name?: string } | undefined)?.full_name || 'Unknown',
            assignmentId: a.id,
            assignmentTitle: a.title,
            sectionTitle: sectionLabelFor(a.syllabus_section_id, sectionRows || []),
            syllabusSectionId: a.syllabus_section_id,
            submissionId: sn.submission_id,
            studentFeedback: studentFb,
            teacherNote,
            scoreExplanations: parseScoreExplanations(sn.score_explanations),
          });
        }

        let averageScores = null;
        if (studentSnapshotsForAggregate.length > 0) {
          const totals = { vision: 0, values: 0, thinking: 0, connection: 0, action: 0 };
          studentSnapshotsForAggregate.forEach((s) => {
            const scores = s.scores as Record<string, number>;
            Object.keys(totals).forEach((k) => {
              totals[k as keyof typeof totals] += scores[k] || 0;
            });
          });
          averageScores = Object.keys(totals).reduce(
            (acc, k) => ({
              ...acc,
              [k]: totals[k as keyof typeof totals] / studentSnapshotsForAggregate.length,
            }),
            {} as Record<string, number>,
          );
        }

        const studentHardSkills =
          hardSkills?.filter((h) => {
            if (h.student_id !== sid) return false;
            const bestForAssignment = bestSnapshotsForStudentPair(
              sid,
              h.assignment_id,
              subs,
              snapRows,
            );
            return bestForAssignment.some((b) => b.submission_id === h.submission_id);
          }) || [];

        return {
          id: sid,
          fullName: profile?.full_name || 'Unknown',
          latestScores: averageScores,
          feedbackCount: studentFeedback.length,
          submissions: studentSubmissions,
          snapshots: studentSnapshotsForAggregate,
          narrativeRows,
          hardSkills: studentHardSkills,
        };
      });

      const aggregatedSnapshotsFlat = processedStudents.flatMap((s) => s.snapshots);

      return {
        studentCount: studentCount || 0,
        assignmentCount: assignments?.length || 0,
        structureType,
        modules,
        assignments: assignmentRefs,
        students: processedStudents,
        allStudents: processedStudents.map((s) => ({ id: s.id, name: s.fullName })),
        rawSubmissions: allSubmissions || [],
        rawSnapshots: aggregatedSnapshotsFlat,
        rawFeedback: feedbackData || [],
        rawHardSkills: hardSkills || [],
      };
    },
    enabled: !!classroomId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
