import type { Analytics5dNarrativeRow } from '@/lib/analytics5dEvidence';
import { build5dNarrativeEvidence } from '@/lib/analytics5dEvidence';
import { runPool } from '@/lib/asyncPool';
import {
  filterReportableAssignments,
  getAllowedAssignmentIds,
  scopedStudentLatestScores,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import {
  buildCohortOutcome,
  buildParticipantRow,
  countCompletedAssignmentsInScope,
  fillRecommendationFallback,
} from '@/lib/pilotReport/buildPilotReportData';
import type { PilotReportAnalyticsData } from '@/lib/pilotReport/computePilotReportDataHash';
import type { PilotCohortSummary, PilotParticipantRow } from '@/lib/pilotReport/types';
import {
  invokePilotCohortSummary,
  invokePilotReadiness,
  type PilotParticipantAssessmentResult,
} from '@/services/pilotReadinessService';
import type { HardSkillAssessment } from '@/types/hard-skills';

function buildHardSkillsSummary(hardSkills: HardSkillAssessment[]): string {
  if (hardSkills.length === 0) return '';
  const parts = hardSkills
    .slice(0, 8)
    .map((h) => `${h.domain} / ${h.skill_component}: ${Math.round(h.current_level_percent)}%`);
  return parts.join('; ');
}

export type GeneratePilotReportInput = {
  classroomId: string;
  analyticsData: PilotReportAnalyticsData & {
    students: Array<
      PilotReportAnalyticsData['students'][number] & {
        hardSkills?: HardSkillAssessment[];
      }
    >;
  };
  scopeModule: AnalyticsModuleFilter;
  scopeAssignment: string;
  language: 'en' | 'he';
  sectionTitleResolver: (syllabusSectionId: string | null) => string;
  recommendationFallback?: string;
  onParticipantDone?: (done: number, total: number) => void;
};

export type GeneratePilotReportResult =
  | {
      ok: true;
      participants: PilotParticipantRow[];
      cohortSummary: PilotCohortSummary;
    }
  | {
      ok: false;
      error: 'all_participants_failed';
      participants: PilotParticipantRow[];
    };

export async function generatePilotReport(
  input: GeneratePilotReportInput,
): Promise<GeneratePilotReportResult> {
  const {
    classroomId,
    analyticsData,
    scopeModule,
    scopeAssignment,
    language,
    sectionTitleResolver,
    recommendationFallback = 'Based on cohort readiness: {{ready}} ready, {{coachOrTraining}} need coaching, {{redirect}} redirect.',
    onParticipantDone,
  } = input;

  const reportableAssignments = filterReportableAssignments(analyticsData.assignments);
  const effectiveAssignmentIds = getAllowedAssignmentIds(
    reportableAssignments,
    scopeModule,
    scopeAssignment,
  );

  if (effectiveAssignmentIds.length === 0) {
    return {
      ok: true,
      participants: [],
      cohortSummary: {
        recommendation: '',
        strongestCapability: '',
        mainGap: '',
        topNextAction: '',
      },
    };
  }

  const denom = effectiveAssignmentIds.length;
  const list = [...analyticsData.students];
  list.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));

  const allStudentsForEvidence = analyticsData.students.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
  }));

  let doneCount = 0;
  const assessments = await runPool(list, 4, async (st) => {
    let assessment: PilotParticipantAssessmentResult | null = null;
    try {
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

      assessment = await invokePilotReadiness({
        classroomId,
        language,
        participantName: st.fullName,
        fiveDScores: scores,
        completionSummary: `${completedInScope} of ${denom} scoped assignments completed`,
        hardSkillsSummary: buildHardSkillsSummary(
          ((st as { hardSkills?: HardSkillAssessment[] }).hardSkills ?? []) as HardSkillAssessment[],
        ),
        evidenceText: evidence.evidenceText || undefined,
      });
    } catch (e) {
      console.error('Pilot readiness assessment failed for', st.fullName, e);
    }
    doneCount += 1;
    onParticipantDone?.(doneCount, list.length);
    return assessment;
  });

  const rows = list.map((st, i) =>
    buildParticipantRow({
      id: st.id,
      name: st.fullName,
      completedInScope: countCompletedAssignmentsInScope(
        st.id,
        st.submissions ?? [],
        effectiveAssignmentIds,
      ),
      assignmentsInScope: denom,
      assessment: assessments[i],
    }),
  );

  const cohortOutcome = buildCohortOutcome(rows);

  if (cohortOutcome.participantsTotal > 0 && cohortOutcome.participantsAssessed === 0) {
    return { ok: false, error: 'all_participants_failed', participants: rows };
  }

  let summary: PilotCohortSummary;
  if (cohortOutcome.participantsAssessed > 0 && cohortOutcome.meanDimensions) {
    try {
      summary = await invokePilotCohortSummary({
        classroomId,
        language,
        participantCount: cohortOutcome.participantsAssessed,
        readinessCounts: cohortOutcome.readinessCounts,
        roleFitCounts: cohortOutcome.roleFitCounts,
        meanDimensions: cohortOutcome.meanDimensions,
      });
    } catch (e) {
      console.error('Pilot cohort summary failed', e);
      summary = {
        recommendation: fillRecommendationFallback(recommendationFallback, cohortOutcome.readinessCounts),
        strongestCapability: '',
        mainGap: '',
        topNextAction: '',
      };
    }
  } else {
    summary = { recommendation: '', strongestCapability: '', mainGap: '', topNextAction: '' };
  }

  return { ok: true, participants: rows, cohortSummary: summary };
}
