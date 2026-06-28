import type { Json } from '@/integrations/supabase/types';
import {
  build5dNarrativeEvidence,
  hashEvidenceKey,
  type Analytics5dNarrativeRow,
} from '@/lib/analytics5dEvidence';
import {
  filterReportableAssignments,
  getAllowedAssignmentIds,
  scopedStudentLatestScores,
  type AnalyticsAssignmentRef,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import { countCompletedAssignmentsInScope } from '@/lib/pilotReport/buildPilotReportData';
import { stableFiveDScoresKey } from '@/lib/fiveDScores';
import type { FiveDScores } from '@/types/models';

function stableScoreKey(scores: FiveDScores | null): string {
<<<<<<< HEAD
  return stableFiveDScoresKey(scores);
=======
  if (!scores) return 'no-scores';
  return FIVED_KEYS.map((k) => {
    const v = scores[k];
    return v == null ? 'null' : v.toFixed(2);
  }).join(',');
>>>>>>> bugs_during_course
}

export type PilotReportAnalyticsStudent = {
  id: string;
  fullName: string;
  submissions?: { student_id: string; assignment_id: string; status: string }[];
  snapshots: Array<{ user_id: string; submission_id: string; scores: Json }>;
  narrativeRows?: Analytics5dNarrativeRow[];
};

export type PilotReportAnalyticsData = {
  assignments: AnalyticsAssignmentRef[];
  students: PilotReportAnalyticsStudent[];
  rawSubmissions: { id: string; assignment_id: string }[];
};

export function computePilotReportDataHash(input: {
  analyticsData: PilotReportAnalyticsData;
  scopeModule: AnalyticsModuleFilter;
  scopeAssignment: string;
  language: 'en' | 'he';
  sectionTitleResolver: (syllabusSectionId: string | null) => string;
}): string {
  const { analyticsData, scopeModule, scopeAssignment, language, sectionTitleResolver } = input;
  const reportableAssignments = filterReportableAssignments(analyticsData.assignments);
  const effectiveAssignmentIds = getAllowedAssignmentIds(
    reportableAssignments,
    scopeModule,
    scopeAssignment,
  );
  const sortedAssignmentIds = [...effectiveAssignmentIds].sort();
  const sortedStudents = [...analyticsData.students].sort((a, b) => a.id.localeCompare(b.id));

  const allStudentsForEvidence = analyticsData.students.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    narrativeRows: s.narrativeRows ?? [],
  }));

  const parts: string[] = [
    'schema:pilot-v2-placementPriority',
    `lang:${language}`,
    `assignments:${sortedAssignmentIds.join(',')}`,
  ];

  for (const st of sortedStudents) {
    const completedInScope = countCompletedAssignmentsInScope(
      st.id,
      st.submissions ?? [],
      effectiveAssignmentIds,
    );
    const scores = scopedStudentLatestScores(
      st.snapshots,
      analyticsData.rawSubmissions,
      effectiveAssignmentIds,
    );
    const evidence = build5dNarrativeEvidence({
      context: 'student_avg',
      allowedAssignmentIds: effectiveAssignmentIds,
      allStudents: allStudentsForEvidence,
      assignmentRefs: reportableAssignments,
      singleStudentId: st.id,
      sectionTitleResolver,
    });
    parts.push(
      `${st.id}|done:${completedInScope}|scores:${stableScoreKey(scores)}|ev:${evidence.evidenceKey}`,
    );
  }

  return hashEvidenceKey(parts.join('\n'));
}
