import type { Json } from '@/integrations/supabase/types';
import { build5dNarrativeEvidence, type Analytics5dNarrativeRow } from '@/lib/analytics5dEvidence';
import { runPool } from '@/lib/asyncPool';
import {
  scopedStudentLatestScores,
  type AnalyticsAssignmentRef,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import {
  setLessonBriefPreloadStatus,
  setLessonBriefStudentNarrativesCache,
} from '@/lib/lessonBriefNarrativeCache';
import {
  invokeExplainAnalytics5d,
  type Analytics5dNarrativeResult,
} from '@/services/analytics5dExplainService';

type PreloadStudent = {
  id: string;
  fullName: string;
  snapshots: Array<{ user_id: string; submission_id: string; scores: Json }>;
  narrativeRows?: Analytics5dNarrativeRow[];
};

type RawSubmission = {
  student_id: string;
  assignment_id: string;
  status: string;
};

export type PrepareLessonBriefNarrativesInput = {
  classroomId: string;
  module: AnalyticsModuleFilter;
  assignment: string;
  language: 'en' | 'he';
  filterSummary: string;
  students: PreloadStudent[];
  assignments: AnalyticsAssignmentRef[];
  rawSubmissions: RawSubmission[];
  effectiveAssignmentIds: string[];
  sectionTitleResolver: (syllabusSectionId: string | null) => string;
  signal?: AbortSignal;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

export async function prepareLessonBriefNarratives(
  input: PrepareLessonBriefNarrativesInput,
): Promise<void> {
  const {
    classroomId,
    module,
    assignment,
    language,
    filterSummary,
    students,
    assignments,
    rawSubmissions,
    effectiveAssignmentIds,
    sectionTitleResolver,
    signal,
  } = input;

  setLessonBriefPreloadStatus(classroomId, module, assignment, 'loading');
  throwIfAborted(signal);

  try {
    const allStudentsForEvidence = students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      narrativeRows: s.narrativeRows ?? [],
    }));

    const studentResults = await runPool(students, 4, async (st) => {
      throwIfAborted(signal);

      const scores = scopedStudentLatestScores(st.snapshots, rawSubmissions, effectiveAssignmentIds);
      if (!scores) {
        return { studentId: st.id, narrative: null as Analytics5dNarrativeResult | null };
      }

      try {
        const evidence = build5dNarrativeEvidence({
          context: 'student_avg',
          allowedAssignmentIds: effectiveAssignmentIds,
          allStudents: allStudentsForEvidence,
          assignmentRefs: assignments,
          singleStudentId: st.id,
          sectionTitleResolver,
        });

        const narrative = await invokeExplainAnalytics5d({
          classroomId,
          context: 'student_avg',
          language,
          scores,
          filterSummary,
          studentName: st.fullName,
          evidenceText: evidence.evidenceText || undefined,
          evidenceSourceCount: evidence.sourceCount,
          brief: true,
        });

        return { studentId: st.id, narrative };
      } catch (e) {
        console.error('Failed to generate lesson brief narrative for', st.fullName, e);
        return { studentId: st.id, narrative: null };
      }
    });

    throwIfAborted(signal);

    setLessonBriefStudentNarrativesCache(classroomId, module, assignment, {
      narratives: studentResults,
      cachedAt: Date.now(),
    });

    setLessonBriefPreloadStatus(classroomId, module, assignment, 'ready');
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return;
    }
    console.error('Failed to prepare lesson brief narratives', e);
    setLessonBriefPreloadStatus(classroomId, module, assignment, 'error');
    throw e;
  }
}
