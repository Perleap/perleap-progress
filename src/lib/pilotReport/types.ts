/**
 * INSAIT Pilot Report — builder-readiness and role-fit decision report.
 * Internal management report: participant names are included by design.
 */

export const PILOT_DIMENSION_KEYS = [
  'builderExecution',
  'conceptualFluency',
  'platformFit',
  'debuggingIndependence',
  'communication',
] as const;

export type PilotDimensionKey = (typeof PILOT_DIMENSION_KEYS)[number];

export type PilotDimensionScores = Record<PilotDimensionKey, number>;

/** Starting-point weights for readiness judgment (sum = 1). */
export const PILOT_DIMENSION_WEIGHTS: Record<PilotDimensionKey, number> = {
  builderExecution: 0.3,
  platformFit: 0.25,
  debuggingIndependence: 0.2,
  conceptualFluency: 0.15,
  communication: 0.1,
};

export const PILOT_READINESS_VALUES = ['ready', 'coach', 'redirect', 'not_ready'] as const;
export type PilotReadiness = (typeof PILOT_READINESS_VALUES)[number];

export const PILOT_ROLE_FIT_VALUES = [
  'builder',
  'analyst',
  'champion',
  'enablement',
  'training',
] as const;
export type PilotRoleFit = (typeof PILOT_ROLE_FIT_VALUES)[number];

export const PILOT_CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;
export type PilotConfidence = (typeof PILOT_CONFIDENCE_VALUES)[number];

export type PilotParticipantRow = {
  id: string;
  name: string;
  completedInScope: number;
  assignmentsInScope: number;
  /** False when the AI assessment failed — row shows "Not assessed" and is excluded from cohort counts. */
  assessed: boolean;
  dimensions: PilotDimensionScores | null;
  /** Weighted 0-100 score; internal model input, not displayed prominently. */
  weightedScore: number | null;
  /** AI placement urgency 1–10; used for appendix ranking, not displayed. */
  placementPriority: number | null;
  readiness: PilotReadiness | null;
  roleFit: PilotRoleFit | null;
  keyStrength: string;
  mainRisk: string;
  nextAction: string;
  confidence: PilotConfidence | null;
  /** 2–3 evidence-grounded bullets from the AI assessment. */
  whyBullets: string[];
};

export type PilotCohortOutcome = {
  participantsAssessed: number;
  participantsTotal: number;
  readinessCounts: Record<PilotReadiness, number>;
  roleFitCounts: Record<PilotRoleFit, number>;
  /** Mean dimension scores over assessed participants; null when none assessed. */
  meanDimensions: PilotDimensionScores | null;
};

export type PilotCohortSummary = {
  recommendation: string;
  strongestCapability: string;
  mainGap: string;
  topNextAction: string;
};

export type PilotReportMeta = {
  classroomLabel: string;
  subject: string;
  filterSummary: string;
  generatedAtDisplay: string;
  language: 'en' | 'he';
  dir: 'ltr' | 'rtl';
  reportId: string;
  logoDataUri?: string;
  assignmentsInScope: number;
  cohortSize: number;
  pilotDateRange?: string;
};

export type PilotReportStaticCopy = {
  documentTitle: string;
  coverEyebrow: string;
  coverTitle: string;
  coverSubtitle: string;
  internalBadge: string;
  labelCourse: string;
  labelSubject: string;
  labelGenerated: string;
  labelScope: string;
  sectionExecutiveSummary: string;
  cohortParticipants: string;
  cohortReady: string;
  cohortCoach: string;
  cohortRedirect: string;
  cohortNotReady: string;
  cohortNotAssessed: string;
  cohortRoleFitDistribution: string;
  scopeFactsLine: string;
  labelAssignmentsInScope: string;
  labelCohortSize: string;
  labelPilotDates: string;
  reportIdLabel: string;
  sectionMethodology: string;
  legendReadinessTitle: string;
  legendReadinessReady: string;
  legendReadinessCoach: string;
  legendReadinessRedirect: string;
  legendReadinessNotReady: string;
  legendWeighting: string;
  legendConfidence: string;
  appendixObservedSignals: string;
  appendixWhyBullets: string;
  recommendationTitle: string;
  findingsTitle: string;
  findingStrongest: string;
  findingGap: string;
  findingNextAction: string;
  recommendationFallback: string;
  sectionCapabilitySnapshot: string;
  sectionCapabilitySnapshotDesc: string;
  sectionDecisionTable: string;
  sectionDecisionTableDesc: string;
  colParticipant: string;
  colReadiness: string;
  colFit: string;
  colStrength: string;
  colRisk: string;
  colNextAction: string;
  colConfidence: string;
  readinessLabels: Record<PilotReadiness, string>;
  roleFitLabels: Record<PilotRoleFit, string>;
  confidenceLabels: Record<PilotConfidence, string>;
  dimensionLabels: Record<PilotDimensionKey, string>;
  notAssessed: string;
  sectionAppendix: string;
  sectionAppendixDesc: string;
  appendixCompleted: string;
  appendixRisk: string;
  appendixNextAction: string;
  footerDisclaimer: string;
  noData: string;
};

export type PilotReportData = {
  meta: PilotReportMeta;
  cohort: PilotCohortOutcome;
  summary: PilotCohortSummary;
  participants: PilotParticipantRow[];
  staticCopy: PilotReportStaticCopy;
};
