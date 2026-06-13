import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { AnalyticsModuleFilter } from '@/lib/analyticsScope';
import {
  computePilotReportDataHash,
  type PilotReportAnalyticsData,
} from '@/lib/pilotReport/computePilotReportDataHash';
import { generatePilotReport } from '@/lib/pilotReport/generatePilotReport';
import type { PilotCohortSummary, PilotParticipantRow } from '@/lib/pilotReport/types';

export type PilotReportSnapshotStatus = 'pending' | 'ready' | 'failed';

export type PilotReportSnapshot = {
  id: string;
  classroomId: string;
  scopeModule: string;
  scopeAssignment: string;
  language: 'en' | 'he';
  dataHash: string;
  status: PilotReportSnapshotStatus;
  participantRows: PilotParticipantRow[];
  cohortSummary: PilotCohortSummary | null;
  errorMessage: string | null;
  startedAt: string | null;
  generatedAt: string | null;
};

/** Wait this long for another tab's in-flight generation before taking over an orphaned pending row. */
export const PENDING_TAKEOVER_MS = 90 * 1000;

const inflight = new Map<string, Promise<PilotReportSnapshot | null>>();

function scopeKey(
  classroomId: string,
  scopeModule: string,
  scopeAssignment: string,
  language: string,
): string {
  return `${classroomId}:${scopeModule}:${scopeAssignment}:${language}`;
}

function parseParticipantRows(raw: unknown): PilotParticipantRow[] {
  if (!Array.isArray(raw)) return [];
  return raw as PilotParticipantRow[];
}

function parseCohortSummary(raw: unknown): PilotCohortSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    recommendation: typeof o.recommendation === 'string' ? o.recommendation : '',
    strongestCapability: typeof o.strongestCapability === 'string' ? o.strongestCapability : '',
    mainGap: typeof o.mainGap === 'string' ? o.mainGap : '',
    topNextAction: typeof o.topNextAction === 'string' ? o.topNextAction : '',
  };
}

function rowToSnapshot(row: {
  id: string;
  classroom_id: string;
  scope_module: string;
  scope_assignment: string;
  language: string;
  data_hash: string;
  status: string;
  participant_rows: unknown;
  cohort_summary: unknown;
  error_message: string | null;
  started_at: string | null;
  generated_at: string | null;
}): PilotReportSnapshot {
  return {
    id: row.id,
    classroomId: row.classroom_id,
    scopeModule: row.scope_module,
    scopeAssignment: row.scope_assignment,
    language: row.language === 'he' ? 'he' : 'en',
    dataHash: row.data_hash,
    status: row.status as PilotReportSnapshotStatus,
    participantRows: parseParticipantRows(row.participant_rows),
    cohortSummary: parseCohortSummary(row.cohort_summary),
    errorMessage: row.error_message,
    startedAt: row.started_at,
    generatedAt: row.generated_at,
  };
}

function pendingAgeMs(snapshot: PilotReportSnapshot): number | null {
  if (!snapshot.startedAt) return null;
  return Date.now() - new Date(snapshot.startedAt).getTime();
}

/** True when we should wait (not start/restart generation) for an existing pending snapshot. */
function shouldDeferToPending(snapshot: PilotReportSnapshot, key: string): boolean {
  if (snapshot.status !== 'pending') return false;
  if (inflight.has(key)) return true;
  const age = pendingAgeMs(snapshot);
  if (age == null) return false;
  return age < PENDING_TAKEOVER_MS;
}

/** Report-page helper: wait briefly for cross-tab generation, then allow takeover. */
export function shouldWaitForPendingSnapshot(
  snapshot: PilotReportSnapshot | null | undefined,
): boolean {
  if (!snapshot || snapshot.status !== 'pending' || !snapshot.startedAt) return false;
  const age = Date.now() - new Date(snapshot.startedAt).getTime();
  return age < PENDING_TAKEOVER_MS;
}

export async function getPilotReportSnapshot(input: {
  classroomId: string;
  scopeModule: AnalyticsModuleFilter;
  scopeAssignment: string;
  language: 'en' | 'he';
}): Promise<PilotReportSnapshot | null> {
  const { data, error } = await supabase
    .from('pilot_report_snapshots')
    .select('*')
    .eq('classroom_id', input.classroomId)
    .eq('scope_module', input.scopeModule)
    .eq('scope_assignment', input.scopeAssignment)
    .eq('language', input.language)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return rowToSnapshot(data);
}

export async function upsertPilotReportPending(input: {
  classroomId: string;
  scopeModule: AnalyticsModuleFilter;
  scopeAssignment: string;
  language: 'en' | 'he';
  dataHash: string;
}): Promise<PilotReportSnapshot> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('pilot_report_snapshots')
    .upsert(
      {
        classroom_id: input.classroomId,
        scope_module: input.scopeModule,
        scope_assignment: input.scopeAssignment,
        language: input.language,
        data_hash: input.dataHash,
        status: 'pending',
        participant_rows: [],
        cohort_summary: null,
        error_message: null,
        started_at: now,
        generated_at: null,
      },
      { onConflict: 'classroom_id,scope_module,scope_assignment,language' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return rowToSnapshot(data);
}

export async function savePilotReportReady(input: {
  classroomId: string;
  scopeModule: AnalyticsModuleFilter;
  scopeAssignment: string;
  language: 'en' | 'he';
  dataHash: string;
  participantRows: PilotParticipantRow[];
  cohortSummary: PilotCohortSummary;
}): Promise<PilotReportSnapshot> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('pilot_report_snapshots')
    .upsert(
      {
        classroom_id: input.classroomId,
        scope_module: input.scopeModule,
        scope_assignment: input.scopeAssignment,
        language: input.language,
        data_hash: input.dataHash,
        status: 'ready',
        participant_rows: input.participantRows as unknown as Json,
        cohort_summary: input.cohortSummary as unknown as Json,
        error_message: null,
        generated_at: now,
      },
      { onConflict: 'classroom_id,scope_module,scope_assignment,language' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return rowToSnapshot(data);
}

export async function savePilotReportFailed(input: {
  classroomId: string;
  scopeModule: AnalyticsModuleFilter;
  scopeAssignment: string;
  language: 'en' | 'he';
  dataHash: string;
  participantRows: PilotParticipantRow[];
  errorMessage: string;
}): Promise<PilotReportSnapshot> {
  const { data, error } = await supabase
    .from('pilot_report_snapshots')
    .upsert(
      {
        classroom_id: input.classroomId,
        scope_module: input.scopeModule,
        scope_assignment: input.scopeAssignment,
        language: input.language,
        data_hash: input.dataHash,
        status: 'failed',
        participant_rows: input.participantRows as unknown as Json,
        cohort_summary: null,
        error_message: input.errorMessage,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'classroom_id,scope_module,scope_assignment,language' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return rowToSnapshot(data);
}

export async function invalidatePilotReportSnapshots(classroomId: string): Promise<void> {
  const { error } = await supabase
    .from('pilot_report_snapshots')
    .delete()
    .eq('classroom_id', classroomId);

  if (error) throw error;
}

export async function deletePilotReportSnapshot(input: {
  classroomId: string;
  scopeModule: AnalyticsModuleFilter;
  scopeAssignment: string;
  language: 'en' | 'he';
}): Promise<void> {
  const { error } = await supabase
    .from('pilot_report_snapshots')
    .delete()
    .eq('classroom_id', input.classroomId)
    .eq('scope_module', input.scopeModule)
    .eq('scope_assignment', input.scopeAssignment)
    .eq('language', input.language);

  if (error) throw error;
}

export type EnsurePilotReportSnapshotInput = {
  classroomId: string;
  scopeModule: AnalyticsModuleFilter;
  scopeAssignment: string;
  language: 'en' | 'he';
  analyticsData: PilotReportAnalyticsData & {
    students: Array<
      PilotReportAnalyticsData['students'][number] & {
        hardSkills?: import('@/types/hard-skills').HardSkillAssessment[];
      }
    >;
  };
  sectionTitleResolver: (syllabusSectionId: string | null) => string;
  recommendationFallback?: string;
  force?: boolean;
};

async function runEnsure(input: EnsurePilotReportSnapshotInput): Promise<PilotReportSnapshot | null> {
  const dataHash = computePilotReportDataHash({
    analyticsData: input.analyticsData,
    scopeModule: input.scopeModule,
    scopeAssignment: input.scopeAssignment,
    language: input.language,
    sectionTitleResolver: input.sectionTitleResolver,
  });

  const existing = await getPilotReportSnapshot({
    classroomId: input.classroomId,
    scopeModule: input.scopeModule,
    scopeAssignment: input.scopeAssignment,
    language: input.language,
  });

  if (!input.force && existing?.status === 'ready' && existing.dataHash === dataHash) {
    return existing;
  }

  // Do NOT check shouldDeferToPending here: runEnsure is the worker that takes over
  // stale/orphaned pending rows. Deferring to pending inside runEnsure would cause
  // self-deferral because the caller already set the inflight entry.

  await upsertPilotReportPending({
    classroomId: input.classroomId,
    scopeModule: input.scopeModule,
    scopeAssignment: input.scopeAssignment,
    language: input.language,
    dataHash,
  });

  const result = await generatePilotReport({
    classroomId: input.classroomId,
    analyticsData: input.analyticsData,
    scopeModule: input.scopeModule,
    scopeAssignment: input.scopeAssignment,
    language: input.language,
    sectionTitleResolver: input.sectionTitleResolver,
    recommendationFallback: input.recommendationFallback,
  });

  if (!result.ok) {
    return savePilotReportFailed({
      classroomId: input.classroomId,
      scopeModule: input.scopeModule,
      scopeAssignment: input.scopeAssignment,
      language: input.language,
      dataHash,
      participantRows: result.participants,
      errorMessage: 'all_participants_failed',
    });
  }

  return savePilotReportReady({
    classroomId: input.classroomId,
    scopeModule: input.scopeModule,
    scopeAssignment: input.scopeAssignment,
    language: input.language,
    dataHash,
    participantRows: result.participants,
    cohortSummary: result.cohortSummary,
  });
}

/**
 * Returns a cached snapshot when fresh, otherwise generates and persists one.
 * Warming only runs while the caller tab stays open (client orchestration).
 */
export async function ensurePilotReportSnapshot(
  input: EnsurePilotReportSnapshotInput,
): Promise<PilotReportSnapshot | null> {
  const key = scopeKey(
    input.classroomId,
    input.scopeModule,
    input.scopeAssignment,
    input.language,
  );

  const dataHash = computePilotReportDataHash({
    analyticsData: input.analyticsData,
    scopeModule: input.scopeModule,
    scopeAssignment: input.scopeAssignment,
    language: input.language,
    sectionTitleResolver: input.sectionTitleResolver,
  });

  if (!input.force) {
    const existing = await getPilotReportSnapshot({
      classroomId: input.classroomId,
      scopeModule: input.scopeModule,
      scopeAssignment: input.scopeAssignment,
      language: input.language,
    });
    if (existing?.status === 'ready' && existing.dataHash === dataHash) {
      return existing;
    }
    if (existing && shouldDeferToPending(existing, key)) {
      return existing;
    }
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = runEnsure(input).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}
