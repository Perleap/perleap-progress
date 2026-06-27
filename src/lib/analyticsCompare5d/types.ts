import type { Json } from '@/integrations/supabase/types';
import type { FiveDScores, FiveDQedMeasures } from '@/types/models';
import type {
  AnalyticsAssignmentRef,
  AnalyticsModuleFilter,
  AnalyticsModuleRef,
} from '@/lib/analyticsScope';
import type { Analytics5dNarrativeRow } from '@/lib/analytics5dEvidence';

export type Compare5dMode = 'sections' | 'students' | 'assignments';

export type Compare5dNarrativeContext =
  | 'module_compare'
  | 'student_compare'
  | 'assignment_compare';

export type Compare5dStudentRow = {
  id: string;
  fullName: string;
  snapshots: {
    user_id: string;
    submission_id: string;
    scores: Json;
    qed_measures?: Json | null;
  }[];
  narrativeRows?: Analytics5dNarrativeRow[];
};

export type Compare5dSideResult = {
  scores: FiveDScores | null;
  qed: FiveDQedMeasures | null;
  evidence: { evidenceText: string; sourceCount: number };
  label: string;
  narrativeContext: Compare5dNarrativeContext;
};

export type ResolveCompare5dSideInput = {
  mode: Compare5dMode;
  sideId: string;
  scopeModule: AnalyticsModuleFilter;
  scopeAssignment: 'all' | string;
  students: Compare5dStudentRow[];
  assignments: AnalyticsAssignmentRef[];
  modules: AnalyticsModuleRef[];
  rawSubmissions: { id: string; assignment_id: string }[];
  rawSnapshots: {
    user_id: string;
    submission_id: string;
    scores: Json;
    qed_measures?: Json | null;
  }[];
  sectionTitleResolver: (syllabusSectionId: string | null) => string;
  labelForSection: (sectionId: string) => string;
  labelForStudent: (studentId: string) => string;
  labelForAssignment: (assignmentId: string) => string;
};
