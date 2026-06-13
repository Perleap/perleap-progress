import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Printer, Download, Loader2, RefreshCw } from 'lucide-react';
import {
  useClassroomAnalytics,
  useClassroom,
  usePilotReportSnapshot,
  useEnsurePilotReportSnapshot,
  useDeletePilotReportSnapshot,
} from '@/hooks/queries';
import { shouldWaitForPendingSnapshot } from '@/services/pilotReportCacheService';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  getAllowedAssignmentIds,
  structureTypeToLabelKey,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import { computePilotReportDataHash } from '@/lib/pilotReport/computePilotReportDataHash';
import {
  PILOT_DIMENSION_KEYS,
  type PilotCohortSummary,
  type PilotParticipantRow,
  type PilotReportData,
} from '@/lib/pilotReport/types';
import {
  buildCohortOutcome,
  buildRoleFitDistributionLine,
  countNotAssessed,
  formatPilotDateRange,
  sortParticipantsForDecision,
} from '@/lib/pilotReport/buildPilotReportData';
import { buildPilotReportHtml } from '@/lib/pilotReport/buildPilotReportHtml';
import { buildPilotReportStaticCopy } from '@/lib/pilotReport/buildPilotReportStaticCopy';
import { fetchLogoDataUri } from '@/lib/pilotReport/fetchLogoDataUri';
import { buildPilotReportId } from '@/lib/pilotReport/pilotReportId';
import { pilotReportDownloadFilename } from '@/lib/pilotReport/pilotReportFilename';

const BLUE = {
  primary: '#3369B7',
  dark: '#1B3A6B',
  labelBg: '#E8F0FA',
  headerBg: '#D6E4F5',
  border: '#B8CFE8',
};

function SectionBar({ num, title }: { num?: string; title: string }) {
  return (
    <div
      className="text-center text-sm font-bold text-white py-2.5 px-4 tracking-wide"
      style={{ backgroundColor: BLUE.primary }}
    >
      {num ? <span className="opacity-80 text-xs me-1.5">{num}</span> : null}
      {title}
    </div>
  );
}

function SectionNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs px-4 py-2 border-b"
      style={{ color: BLUE.primary, backgroundColor: '#f7fafd', borderColor: BLUE.border }}
    >
      {children}
    </p>
  );
}

function readinessPillStyle(readiness: PilotParticipantRow['readiness']): React.CSSProperties {
  switch (readiness) {
    case 'ready':
      return { backgroundColor: '#E2F5EA', color: '#1E7A45', borderColor: '#B5E0C6' };
    case 'coach':
      return { backgroundColor: '#FFF4DC', color: '#946300', borderColor: '#EFD9A2' };
    case 'redirect':
      return { backgroundColor: '#EDE8FA', color: '#5B41A8', borderColor: '#CFC3EE' };
    case 'not_ready':
      return { backgroundColor: '#FDE8E8', color: '#B43333', borderColor: '#ECB8B8' };
    default:
      return { backgroundColor: BLUE.headerBg, color: BLUE.primary, borderColor: BLUE.border };
  }
}

function MiniDimensionBars({
  dimensions,
  labels,
}: {
  dimensions: NonNullable<PilotParticipantRow['dimensions']>;
  labels: Record<(typeof PILOT_DIMENSION_KEYS)[number], string>;
}) {
  return (
    <div className="space-y-1.5 my-2">
      {PILOT_DIMENSION_KEYS.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-36 shrink-0 text-[0.65rem] font-semibold" style={{ color: BLUE.dark }}>
            {labels[key]}
          </span>
          <div className="flex-1 h-2 rounded-sm overflow-hidden" style={{ backgroundColor: '#dde8f4' }}>
            <div
              className="h-full rounded-sm"
              style={{
                width: `${Math.max(0, Math.min(100, dimensions[key]))}%`,
                backgroundColor: BLUE.primary,
              }}
            />
          </div>
          <span className="w-8 text-[0.65rem] font-bold text-end" style={{ color: BLUE.dark }}>
            {dimensions[key]}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PilotReportPage() {
  const { id: classroomId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL, language: uiLanguage } = useLanguage();
  const analyticsLanguage = uiLanguage === 'he' ? 'he' : 'en';

  const selectedModule = (searchParams.get('analyticsModule') as AnalyticsModuleFilter) || 'all';
  const selectedAssignment = searchParams.get('analyticsAssignment') || 'all';

  const { data, isLoading } = useClassroomAnalytics(classroomId!);
  const { data: classroom } = useClassroom(classroomId);
  const { data: snapshot, isLoading: snapshotLoading } = usePilotReportSnapshot(
    classroomId,
    selectedModule,
    selectedAssignment,
    analyticsLanguage,
  );
  const ensureSnapshot = useEnsurePilotReportSnapshot();
  const deleteSnapshot = useDeletePilotReportSnapshot();

  const [regenerateKey, setRegenerateKey] = useState(0);
  const [pendingTick, setPendingTick] = useState(0);
  const ensureTriggeredRef = useRef<string | null>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | undefined>();
  const [reportId, setReportId] = useState(() => buildPilotReportId(undefined));

  const assignments = data?.assignments || [];
  const modules = data?.modules || [];

  const effectiveAssignmentIds = useMemo(
    () => getAllowedAssignmentIds(assignments, selectedModule, selectedAssignment),
    [assignments, selectedModule, selectedAssignment],
  );

  const filterSummary = useMemo(() => {
    const structKey = structureTypeToLabelKey(data?.structureType ?? undefined);
    const allModulesLabel = t('analytics.allSyllabusSections', {
      sectionType: t(`syllabus.${structKey}`),
    });
    const mod =
      selectedModule === 'all'
        ? allModulesLabel
        : selectedModule === 'unplaced'
          ? t('analytics.unplacedAssignments')
          : (modules.find((m) => m.id === selectedModule)?.title ?? selectedModule);
    const asg =
      selectedAssignment === 'all'
        ? selectedModule === 'all'
          ? t('analytics.allAssignments')
          : t('analytics.allAssignmentsInScope')
        : (assignments.find((a) => a.id === selectedAssignment)?.title ?? selectedAssignment);
    return [mod, asg].join(' | ');
  }, [selectedModule, selectedAssignment, modules, assignments, data?.structureType, t]);

  const sectionTitleResolver = useCallback(
    (syllabusSectionId: string | null) => {
      if (syllabusSectionId == null) return t('analytics.unplacedAssignments');
      return modules.find((m) => m.id === syllabusSectionId)?.title ?? '—';
    },
    [modules, t],
  );

  const staticCopy = useMemo(() => buildPilotReportStaticCopy(t), [t]);

  const dataHash = useMemo(() => {
    if (!data) return null;
    return computePilotReportDataHash({
      analyticsData: data,
      scopeModule: selectedModule,
      scopeAssignment: selectedAssignment,
      language: analyticsLanguage,
      sectionTitleResolver,
    });
  }, [data, selectedModule, selectedAssignment, analyticsLanguage, sectionTitleResolver]);

  const participants = snapshot?.participantRows ?? [];
  const cohortSummary: PilotCohortSummary | null =
    snapshot?.status === 'ready' && snapshot.dataHash === dataHash
      ? snapshot.cohortSummary
      : null;

  const isSnapshotFresh =
    snapshot?.status === 'ready' && dataHash != null && snapshot.dataHash === dataHash;
  const isError = snapshot?.status === 'failed';
  const isGenerating =
    !isSnapshotFresh &&
    !isError &&
    (snapshot?.status === 'pending' || ensureSnapshot.isPending || snapshotLoading);
  const isReady = isSnapshotFresh && cohortSummary != null;

  useEffect(() => {
    void fetchLogoDataUri().then(setLogoDataUri);
  }, []);

  useEffect(() => {
    if (snapshot?.status !== 'pending') return;
    const id = setInterval(() => setPendingTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [snapshot?.status]);

  useEffect(() => {
    if (classroom?.name) {
      setReportId(buildPilotReportId(classroom.name));
    }
  }, [classroom?.name, regenerateKey]);

  useEffect(() => {
    if (!data || !classroomId || snapshotLoading || dataHash == null) return;
    if (isSnapshotFresh) {
      ensureTriggeredRef.current = null;
      return;
    }
    if (shouldWaitForPendingSnapshot(snapshot)) {
      return;
    }

    const triggerKey = `${classroomId}:${selectedModule}:${selectedAssignment}:${analyticsLanguage}:${dataHash}:${regenerateKey}`;
    if (ensureTriggeredRef.current === triggerKey) return;
    ensureTriggeredRef.current = triggerKey;

    void ensureSnapshot.mutateAsync({
      classroomId,
      scopeModule: selectedModule,
      scopeAssignment: selectedAssignment,
      language: analyticsLanguage,
      analyticsData: data,
      sectionTitleResolver,
      recommendationFallback: t('pilotReport.recommendationFallback'),
      force: regenerateKey > 0,
    });
  }, [
    data,
    classroomId,
    snapshotLoading,
    dataHash,
    isSnapshotFresh,
    snapshot?.status,
    selectedModule,
    selectedAssignment,
    analyticsLanguage,
    sectionTitleResolver,
    regenerateKey,
    pendingTick,
    t,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutateAsync is stable enough; avoid re-trigger loops
  ]);

  const cohort = useMemo(() => buildCohortOutcome(participants), [participants]);

  const sortedParticipants = useMemo(
    () => sortParticipantsForDecision(participants),
    [participants],
  );

  const notAssessedCount = useMemo(() => countNotAssessed(participants), [participants]);

  const roleFitLine = useMemo(
    () => buildRoleFitDistributionLine(cohort.roleFitCounts, staticCopy.roleFitLabels),
    [cohort.roleFitCounts, staticCopy.roleFitLabels],
  );

  const pilotDateRange = useMemo(
    () =>
      formatPilotDateRange(
        classroom?.start_date,
        classroom?.end_date,
        uiLanguage === 'he' ? 'he-IL' : 'en-US',
      ),
    [classroom?.start_date, classroom?.end_date, uiLanguage],
  );

  const pilotDateRangeDisplay = pilotDateRange ?? '';

  const generatedAtDisplay = useMemo(
    () =>
      new Date().toLocaleDateString(uiLanguage === 'he' ? 'he-IL' : 'en-US', {
        dateStyle: 'medium',
      }),
    // Re-derive after generation completes so the displayed date matches export time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uiLanguage, isReady],
  );

  const reportData = useMemo<PilotReportData | null>(() => {
    if (!isReady || !cohortSummary) return null;
    return {
      meta: {
        classroomLabel: classroom?.name || '—',
        subject: classroom?.subject || '—',
        filterSummary,
        generatedAtDisplay,
        language: analyticsLanguage,
        dir: isRTL ? 'rtl' : 'ltr',
        reportId,
        logoDataUri,
        assignmentsInScope: effectiveAssignmentIds.length,
        cohortSize: data?.students.length ?? 0,
        pilotDateRange,
      },
      cohort,
      summary: cohortSummary,
      participants: sortedParticipants,
      staticCopy,
    };
  }, [
    isReady,
    cohortSummary,
    classroom?.name,
    classroom?.subject,
    filterSummary,
    generatedAtDisplay,
    analyticsLanguage,
    isRTL,
    cohort,
    sortedParticipants,
    staticCopy,
    reportId,
    logoDataUri,
    effectiveAssignmentIds.length,
    data?.students.length,
    pilotDateRange,
  ]);

  const handleDownloadHtml = useCallback(() => {
    if (!reportData) return;
    const html = buildPilotReportHtml(reportData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pilotReportDownloadFilename(classroom?.name);
    a.click();
    URL.revokeObjectURL(url);
  }, [reportData, classroom?.name]);

  const handleRegenerate = useCallback(async () => {
    if (!classroomId) return;
    ensureTriggeredRef.current = null;
    await deleteSnapshot.mutateAsync({
      classroomId,
      scopeModule: selectedModule,
      scopeAssignment: selectedAssignment,
      language: analyticsLanguage,
    });
    setRegenerateKey((k) => k + 1);
  }, [
    classroomId,
    deleteSnapshot,
    selectedModule,
    selectedAssignment,
    analyticsLanguage,
  ]);

  const studentTotal = data?.students.length ?? 0;
  const progressMessage =
    snapshot?.status === 'pending' || ensureSnapshot.isPending
      ? t('pilotReport.assessingProgress', {
          done: Math.min((snapshot?.participantRows.length ?? 0) + 1, studentTotal || 1),
          total: studentTotal || 1,
        })
      : t('pilotReport.preparingReport');

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const findings = cohortSummary
    ? [
        [staticCopy.findingStrongest, cohortSummary.strongestCapability],
        [staticCopy.findingGap, cohortSummary.mainGap],
        [staticCopy.findingNextAction, cohortSummary.topNextAction],
      ].filter(([, text]) => text && text.trim().length > 0)
    : [];

  const toolbar = (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border no-print print:hidden">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={handleRegenerate}
            disabled={isGenerating}
          >
            <RefreshCw className="h-4 w-4 me-1.5" aria-hidden />
            {t('pilotReport.regenerate')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => window.print()}
            disabled={!isReady}
          >
            <Printer className="h-4 w-4 me-1.5" aria-hidden />
            {t('common.print', 'Print')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={handleDownloadHtml}
            disabled={!isReady}
          >
            <Download className="h-4 w-4 me-1.5" aria-hidden />
            {t('common.download', 'Download HTML')}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!isReady) {
    if (isError) {
      return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#eef2f7' }} dir={isRTL ? 'rtl' : 'ltr'}>
          {toolbar}
          <div className="flex-1 flex items-center justify-center px-4 py-16">
            <div
              className="max-w-md w-full rounded-xl border px-8 py-10 text-center shadow-sm"
              style={{ backgroundColor: '#fff', borderColor: BLUE.border }}
            >
              <p className="text-lg font-semibold" style={{ color: BLUE.dark }}>
                {t('pilotReport.generationFailed')}
              </p>
              <p className="text-sm mt-2 text-slate-600">{t('pilotReport.generationFailedHint')}</p>
              <Button type="button" className="mt-6 rounded-lg" onClick={handleRegenerate}>
                <RefreshCw className="h-4 w-4 me-1.5" aria-hidden />
                {t('pilotReport.retry')}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#eef2f7' }} dir={isRTL ? 'rtl' : 'ltr'}>
        {toolbar}
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div
            className="max-w-md w-full rounded-xl border px-8 py-10 text-center shadow-sm"
            style={{ backgroundColor: '#fff', borderColor: BLUE.border }}
          >
            <Loader2
              className="h-10 w-10 animate-spin mx-auto mb-4"
              style={{ color: BLUE.primary }}
              aria-hidden
            />
            <p className="text-lg font-semibold" style={{ color: BLUE.dark }}>
              {t('pilotReport.preparingReport')}
            </p>
            <p className="text-sm mt-2" style={{ color: BLUE.primary }}>
              {progressMessage}
            </p>
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              {t('pilotReport.preparingReportHint')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#eef2f7' }} dir={isRTL ? 'rtl' : 'ltr'}>
      {toolbar}

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div
          className="bg-white border shadow-sm"
          style={{ borderColor: BLUE.border }}
        >
          {/* Title block */}
          <header
            className="text-center px-8 pt-8 pb-6 border-b"
            style={{
              background: `linear-gradient(180deg, ${BLUE.headerBg} 0%, #fff 100%)`,
              borderColor: BLUE.border,
            }}
          >
            <img src="/perleap.svg" alt="Perleap" className="h-9 mx-auto mb-3" />
            <p
              className="text-[0.7rem] uppercase font-bold tracking-[0.12em]"
              style={{ color: BLUE.primary }}
            >
              {staticCopy.coverEyebrow}
            </p>
            <h1
              className="text-3xl font-bold my-1"
              style={{ color: BLUE.dark, fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              {staticCopy.coverTitle}
            </h1>
            <p className="text-sm font-semibold mt-3" style={{ color: BLUE.dark }}>
              {classroom?.name || '—'}
            </p>
            {pilotDateRangeDisplay ? (
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{pilotDateRangeDisplay}</p>
            ) : null}
          </header>

          {/* 01 Executive summary */}
          <section>
            <SectionBar num="01" title={staticCopy.sectionExecutiveSummary} />
            <table className="w-full text-sm border-collapse">
              <tbody>
                {[
                  [
                    staticCopy.cohortParticipants,
                    `${cohort.participantsAssessed} of ${cohort.participantsTotal}`,
                  ],
                  [staticCopy.cohortReady, String(cohort.readinessCounts.ready)],
                  [staticCopy.cohortCoach, String(cohort.readinessCounts.coach)],
                  [staticCopy.cohortRedirect, String(cohort.readinessCounts.redirect)],
                  [staticCopy.cohortNotReady, String(cohort.readinessCounts.not_ready)],
                  ...(notAssessedCount > 0
                    ? [[staticCopy.cohortNotAssessed, String(notAssessedCount)] as [string, string]]
                    : []),
                  ...(roleFitLine
                    ? [[staticCopy.cohortRoleFitDistribution, roleFitLine] as [string, string]]
                    : []),
                ].map(([label, value]) => (
                  <tr key={label} className="border-b last:border-b-0" style={{ borderColor: BLUE.border }}>
                    <td
                      className="w-2/5 px-4 py-2.5 font-semibold align-top border-e"
                      style={{ backgroundColor: BLUE.labelBg, color: BLUE.dark, borderColor: BLUE.border }}
                    >
                      {label}
                    </td>
                    <td className="px-4 py-2.5 font-bold" style={{ color: BLUE.dark }}>
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cohortSummary?.recommendation ? (
              <p
                className="text-sm leading-relaxed px-4 py-3 border-b"
                style={{ backgroundColor: BLUE.labelBg, borderColor: BLUE.border }}
              >
                {cohortSummary.recommendation}
              </p>
            ) : null}
            {findings.length > 0 ? (
              <ul className="px-4 py-3 space-y-1.5 border-b list-disc list-inside" style={{ borderColor: BLUE.border }}>
                {findings.map(([label, text]) => (
                  <li key={label} className="text-sm text-slate-700">
                    <span className="font-bold" style={{ color: BLUE.dark }}>
                      {label}:
                    </span>{' '}
                    {text}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {/* 02 Cohort capability snapshot */}
          <section>
            <SectionBar num="02" title={staticCopy.sectionCapabilitySnapshot} />
            <SectionNote>{staticCopy.sectionCapabilitySnapshotDesc}</SectionNote>
            <div className="p-4 space-y-3">
              {cohort.meanDimensions ? (
                PILOT_DIMENSION_KEYS.map((key) => {
                  const value = cohort.meanDimensions![key];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span
                        className="w-48 shrink-0 text-xs font-semibold"
                        style={{ color: BLUE.dark }}
                      >
                        {staticCopy.dimensionLabels[key]}
                      </span>
                      <div className="flex-1 h-3.5 rounded-sm overflow-hidden" style={{ backgroundColor: '#dde8f4' }}>
                        <div
                          className="h-full rounded-sm"
                          style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: BLUE.primary }}
                        />
                      </div>
                      <span className="w-10 text-xs font-bold text-end" style={{ color: BLUE.dark }}>
                        {value}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">
                  {staticCopy.noData}
                </p>
              )}
            </div>
          </section>

          {/* 03 Participant decision table */}
          <section>
            <SectionBar num="03" title={staticCopy.sectionDecisionTable} />
            <SectionNote>{staticCopy.sectionDecisionTableDesc}</SectionNote>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[760px]">
                <thead>
                  <tr style={{ backgroundColor: BLUE.headerBg }}>
                    {[
                      staticCopy.colParticipant,
                      staticCopy.colReadiness,
                      staticCopy.colFit,
                      staticCopy.colStrength,
                      staticCopy.colRisk,
                      staticCopy.colNextAction,
                      staticCopy.colConfidence,
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-start text-[0.7rem] font-bold px-2.5 py-2 border-b"
                        style={{ color: BLUE.dark, borderColor: BLUE.border }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-slate-500">
                        {staticCopy.noData}
                      </td>
                    </tr>
                  ) : (
                    sortedParticipants.map((p) => (
                      <tr key={p.id} className="border-b last:border-b-0 align-top" style={{ borderColor: BLUE.border }}>
                        <td className="px-2.5 py-2 font-bold text-slate-800">{p.name}</td>
                        {p.assessed ? (
                          <>
                            <td className="px-2.5 py-2">
                              <span
                                className="inline-block px-2 py-0.5 rounded-full text-[0.68rem] font-bold whitespace-nowrap border"
                                style={readinessPillStyle(p.readiness)}
                              >
                                {p.readiness ? staticCopy.readinessLabels[p.readiness] : staticCopy.noData}
                              </span>
                            </td>
                            <td className="px-2.5 py-2 text-slate-700">
                              {p.roleFit ? staticCopy.roleFitLabels[p.roleFit] : staticCopy.noData}
                            </td>
                            <td className="px-2.5 py-2 text-slate-700">{p.keyStrength || staticCopy.noData}</td>
                            <td className="px-2.5 py-2 text-slate-700">{p.mainRisk || staticCopy.noData}</td>
                            <td className="px-2.5 py-2 text-slate-700">{p.nextAction || staticCopy.noData}</td>
                            <td className="px-2.5 py-2 text-slate-700">
                              {p.confidence ? staticCopy.confidenceLabels[p.confidence] : staticCopy.noData}
                            </td>
                          </>
                        ) : (
                          <td colSpan={6} className="px-2.5 py-2 text-slate-400">
                            {staticCopy.notAssessed}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Appendix */}
          {sortedParticipants.some((p) => p.assessed) ? (
            <section>
              <SectionBar title={staticCopy.sectionAppendix} />
              <SectionNote>{staticCopy.sectionAppendixDesc}</SectionNote>
              <div className="p-4 space-y-3">
                {sortedParticipants
                  .filter((p) => p.assessed)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="border px-4 py-3"
                      style={{ borderColor: BLUE.border, backgroundColor: '#f7fafd' }}
                    >
                      <p className="text-sm font-bold" style={{ color: BLUE.dark }}>
                        {p.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 mb-2">
                        {p.roleFit ? staticCopy.roleFitLabels[p.roleFit] : staticCopy.noData} ·{' '}
                        {p.readiness ? staticCopy.readinessLabels[p.readiness] : staticCopy.noData} ·{' '}
                        {p.confidence ? staticCopy.confidenceLabels[p.confidence] : staticCopy.noData} ·{' '}
                        {staticCopy.appendixCompleted}: {p.completedInScope}/{p.assignmentsInScope}
                      </p>
                      {p.dimensions ? (
                        <div>
                          <p className="text-[0.65rem] font-bold uppercase tracking-wide mb-1" style={{ color: BLUE.dark }}>
                            {staticCopy.appendixObservedSignals}
                          </p>
                          <MiniDimensionBars dimensions={p.dimensions} labels={staticCopy.dimensionLabels} />
                        </div>
                      ) : null}
                      {p.whyBullets.length > 0 ? (
                        <div className="mt-2">
                          <p className="text-xs font-bold" style={{ color: BLUE.dark }}>
                            {staticCopy.appendixWhyBullets}
                          </p>
                          <ul className="list-disc list-inside text-xs text-slate-700 mt-1 space-y-0.5">
                            {p.whyBullets.map((bullet, i) => (
                              <li key={`${p.id}-why-${i}`}>{bullet}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {p.keyStrength ? <p className="text-xs text-slate-700 mb-1 mt-2">{p.keyStrength}</p> : null}
                      {p.mainRisk ? (
                        <p className="text-xs text-slate-700 mb-1">
                          <span className="font-bold" style={{ color: BLUE.dark }}>
                            {staticCopy.appendixRisk}:
                          </span>{' '}
                          {p.mainRisk}
                        </p>
                      ) : null}
                      {p.nextAction ? (
                        <p className="text-xs text-slate-700">
                          <span className="font-bold" style={{ color: BLUE.dark }}>
                            {staticCopy.appendixNextAction}:
                          </span>{' '}
                          {p.nextAction}
                        </p>
                      ) : null}
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          <section>
            <SectionBar title={staticCopy.sectionMethodology} />
            <div
              className="px-4 py-3 text-xs text-slate-700 space-y-1.5 leading-relaxed border-t"
              style={{ borderColor: BLUE.border, backgroundColor: '#f7fafd' }}
            >
              <p className="font-bold" style={{ color: BLUE.dark }}>
                {staticCopy.legendReadinessTitle}
              </p>
              <p>{staticCopy.legendReadinessReady}</p>
              <p>{staticCopy.legendReadinessCoach}</p>
              <p>{staticCopy.legendReadinessRedirect}</p>
              <p>{staticCopy.legendReadinessNotReady}</p>
              <p>{staticCopy.legendWeighting}</p>
              <p>{staticCopy.legendConfidence}</p>
            </div>
          </section>

          <footer
            className="text-center text-xs text-slate-500 px-4 py-5 border-t"
            style={{ borderColor: BLUE.border, backgroundColor: '#f7fafd' }}
          >
            {staticCopy.footerDisclaimer}
            <p className="mt-2 text-[0.7rem] text-slate-400">
              {staticCopy.reportIdLabel}: {reportId} · {generatedAtDisplay}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
