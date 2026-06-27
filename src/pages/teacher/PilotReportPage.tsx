import { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, FileDown, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
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
  filterReportableAssignments,
  getAllowedAssignmentIds,
  structureTypeToLabelKey,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import { computePilotReportDataHash } from '@/lib/pilotReport/computePilotReportDataHash';
import {
  PILOT_DIMENSION_KEYS,
  PILOT_READINESS_VALUES,
  type PilotCohortSummary,
  type PilotParticipantRow,
  type PilotReportData,
  type PilotReportStaticCopy,
} from '@/lib/pilotReport/types';
import {
  buildCohortOutcome,
  buildRoleFitDistributionLine,
  countNotAssessed,
  formatPilotDateRange,
  formatCompletionPercent,
  rankParticipantsForAppendix,
} from '@/lib/pilotReport/buildPilotReportData';
import { buildPieChartSvg, READINESS_PIE_COLORS } from '@/lib/pilotReport/buildPieChartSvg';
import { buildPilotReportHtml } from '@/lib/pilotReport/buildPilotReportHtml';
import { buildPilotReportStaticCopy } from '@/lib/pilotReport/buildPilotReportStaticCopy';
import { exportPilotReportPdf } from '@/lib/pilotReport/exportPilotReportPdf';
import { fetchLogoDataUri } from '@/lib/pilotReport/fetchLogoDataUri';
import { buildPilotReportId } from '@/lib/pilotReport/pilotReportId';
import { pilotReportDownloadFilename, pilotReportPdfFilename } from '@/lib/pilotReport/pilotReportFilename';

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

function MethodologyLegend({ staticCopy }: { staticCopy: PilotReportStaticCopy }) {
  return (
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
      </div>
    </section>
  );
}

function ReadinessPieChart({
  cohort,
  staticCopy,
  notAssessedCount,
}: {
  cohort: ReturnType<typeof buildCohortOutcome>;
  staticCopy: PilotReportStaticCopy;
  notAssessedCount: number;
}) {
  const svg = useMemo(() => {
    const segments = PILOT_READINESS_VALUES.map((key) => ({
      label: staticCopy.readinessLabels[key],
      value: cohort.readinessCounts[key],
      color: READINESS_PIE_COLORS[key],
    }));
    if (notAssessedCount > 0) {
      segments.push({
        label: staticCopy.cohortNotAssessed,
        value: notAssessedCount,
        color: READINESS_PIE_COLORS.not_assessed,
      });
    }
    return buildPieChartSvg({
      segments,
      ariaLabel: staticCopy.sectionExecutiveSummary,
      centerLabel: String(cohort.participantsAssessed),
    });
  }, [cohort, staticCopy, notAssessedCount]);

  if (!svg) return null;
  return (
    <div
      className="p-6 border-b min-h-[280px] flex items-center"
      style={{ borderColor: BLUE.border }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const SUMMARY_COLUMN_STYLES = {
  strength: {
    header: '#1E7A45',
    background: '#E2F5EA',
    text: '#1a5c35',
    border: '#B5E0C6',
  },
  risk: {
    header: '#B43333',
    background: '#FDE8E8',
    text: '#8c2828',
    border: '#ECB8B8',
  },
  action: {
    header: '#3369B7',
    background: '#E8F0FA',
    text: '#1B3A6B',
    border: '#B8CFE8',
  },
} as const;

const BADGE_SIZE_PX = 56;

function badgeCircleStyle(sizePx: number, extra?: CSSProperties): CSSProperties {
  return {
    width: sizePx,
    height: sizePx,
    minWidth: sizePx,
    minHeight: sizePx,
    display: 'inline-grid',
    placeItems: 'center',
    justifyItems: 'center',
    textAlign: 'center',
    direction: 'ltr',
    boxSizing: 'border-box',
    ...extra,
  };
}

function ParticipantCardBadges({
  participant,
  staticCopy,
}: {
  participant: PilotParticipantRow & { rank: number };
  staticCopy: PilotReportStaticCopy;
}) {
  const readinessLabel = participant.readiness
    ? staticCopy.readinessLabels[participant.readiness]
    : staticCopy.noData;
  const completionPct = formatCompletionPercent(
    participant.completedInScope,
    participant.assignmentsInScope,
  );

  return (
    <div className="flex shrink-0 items-center gap-1.5" dir="ltr">
      <div
        className="shrink-0 rounded-full border-2 font-bold"
        style={badgeCircleStyle(BADGE_SIZE_PX, {
          ...readinessPillStyle(participant.readiness),
          fontSize: '0.55rem',
          lineHeight: 1.15,
          padding: '0 4px',
        })}
        title={readinessLabel}
      >
        {readinessLabel}
      </div>
      <div
        className="shrink-0 rounded-full border-2 border-white font-bold"
        style={badgeCircleStyle(BADGE_SIZE_PX, {
          backgroundColor: BLUE.labelBg,
          color: BLUE.dark,
          fontSize: '0.75rem',
          lineHeight: 1,
          padding: 0,
        })}
        title={staticCopy.appendixCompleted}
      >
        {completionPct}
      </div>
      <div
        className="shrink-0 rounded-full border-2 border-white font-bold text-white"
        style={badgeCircleStyle(BADGE_SIZE_PX, {
          backgroundColor: BLUE.primary,
          fontSize: '0.75rem',
          lineHeight: 1,
          padding: 0,
        })}
        aria-label={`#${participant.rank}`}
      >
        #{participant.rank}
      </div>
    </div>
  );
}

function AppendixSummaryGrid({
  participant,
  staticCopy,
}: {
  participant: PilotParticipantRow;
  staticCopy: PilotReportStaticCopy;
}) {
  const columns: { variant: keyof typeof SUMMARY_COLUMN_STYLES; label: string; text: string }[] = [
    {
      variant: 'strength',
      label: staticCopy.colStrength,
      text: participant.keyStrength || staticCopy.noData,
    },
    {
      variant: 'risk',
      label: staticCopy.colRisk,
      text: participant.mainRisk || staticCopy.noData,
    },
    {
      variant: 'action',
      label: staticCopy.colNextAction,
      text: participant.nextAction || staticCopy.noData,
    },
  ];

  return (
    <div
      className="grid grid-cols-3 gap-2 w-full mt-3 pt-3 border-t"
      style={{ borderColor: BLUE.border }}
    >
      {columns.map(({ variant, label, text }) => {
        const style = SUMMARY_COLUMN_STYLES[variant];
        return (
          <div
            key={variant}
            className="rounded-sm px-2.5 py-2 text-xs min-w-0"
            style={{
              backgroundColor: style.background,
              border: `1px solid ${style.border}`,
            }}
          >
            <p className="font-bold mb-1" style={{ color: style.header }}>
              {label}
            </p>
            <p className="leading-relaxed" style={{ color: style.text }}>
              {text}
            </p>
          </div>
        );
      })}
    </div>
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
  const reportDocRef = useRef<HTMLDivElement>(null);
  const [logoDataUri, setLogoDataUri] = useState<string | undefined>();
  const [reportId, setReportId] = useState(() => buildPilotReportId(undefined));
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const assignments = data?.assignments || [];
  const reportableAssignments = useMemo(
    () => filterReportableAssignments(assignments),
    [assignments],
  );
  const modules = data?.modules || [];

  const effectiveAssignmentIds = useMemo(
    () => getAllowedAssignmentIds(reportableAssignments, selectedModule, selectedAssignment),
    [reportableAssignments, selectedModule, selectedAssignment],
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

  const rankedAppendix = useMemo(
    () => rankParticipantsForAppendix(participants),
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
      participants,
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
    participants,
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

  const handleExportPdf = useCallback(async () => {
    if (!reportData || !isReady) return;
    setIsExportingPdf(true);
    try {
      await exportPilotReportPdf(reportData, pilotReportPdfFilename(classroom?.name));
    } catch {
      toast.error(t('pilotReport.exportPdfError'));
    } finally {
      setIsExportingPdf(false);
    }
  }, [reportData, classroom?.name, isReady, t]);

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
            onClick={() => void handleExportPdf()}
            disabled={!reportData || !isReady || isExportingPdf}
          >
            {isExportingPdf ? (
              <Loader2 className="h-4 w-4 me-1.5 animate-spin" aria-hidden />
            ) : (
              <FileDown className="h-4 w-4 me-1.5" aria-hidden />
            )}
            {t('pilotReport.exportPdf')}
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
          id="pilot-report-doc"
          ref={reportDocRef}
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
            <div className="text-xs text-slate-500 mt-2 leading-relaxed space-y-0.5">
              {pilotDateRangeDisplay ? <p>{pilotDateRangeDisplay}</p> : null}
              <p>
                {staticCopy.labelAssignmentsInScope}: {effectiveAssignmentIds.length}
              </p>
              <p>
                {staticCopy.labelCohortSize}: {data?.students.length ?? 0}
              </p>
            </div>
          </header>

          <MethodologyLegend staticCopy={staticCopy} />

          {/* 01 Executive summary */}
          <section>
            <SectionBar num="01" title={staticCopy.sectionExecutiveSummary} />
            <ReadinessPieChart
              cohort={cohort}
              staticCopy={staticCopy}
              notAssessedCount={notAssessedCount}
            />
            <p className="text-sm px-4 py-2.5 border-b text-slate-700" style={{ borderColor: BLUE.border }}>
              <span className="font-semibold" style={{ color: BLUE.dark }}>
                {staticCopy.cohortParticipants}:
              </span>{' '}
              {cohort.participantsAssessed} of {cohort.participantsTotal}
            </p>
            {roleFitLine ? (
              <p className="text-sm px-4 py-2.5 border-b text-slate-700" style={{ borderColor: BLUE.border }}>
                <span className="font-semibold" style={{ color: BLUE.dark }}>
                  {staticCopy.cohortRoleFitDistribution}:
                </span>{' '}
                {roleFitLine}
              </p>
            ) : null}
          </section>

          {/* Appendix */}
          {rankedAppendix.length > 0 ? (
            <section>
              <SectionBar title={staticCopy.sectionAppendix} />
              <SectionNote>{staticCopy.sectionAppendixDesc}</SectionNote>
              <div className="p-4 space-y-3">
                {rankedAppendix.map((p) => (
                    <div
                      key={p.id}
                      className="border px-4 py-3"
                      style={{ borderColor: BLUE.border, backgroundColor: '#f7fafd' }}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm font-bold min-w-0" style={{ color: BLUE.dark }}>
                          {p.name}
                        </p>
                        <ParticipantCardBadges participant={p} staticCopy={staticCopy} />
                      </div>
                      {p.dimensions ? (
                        <div className="mt-2">
                          <p className="text-[0.65rem] font-bold uppercase tracking-wide mb-1" style={{ color: BLUE.dark }}>
                            {staticCopy.appendixObservedSignals}
                          </p>
                          <MiniDimensionBars dimensions={p.dimensions} labels={staticCopy.dimensionLabels} />
                        </div>
                      ) : null}
                      <AppendixSummaryGrid participant={p} staticCopy={staticCopy} />
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

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
