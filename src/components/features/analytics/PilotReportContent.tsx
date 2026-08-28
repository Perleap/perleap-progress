import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import {
  filterReportableAssignments,
  getAllowedAssignmentIds,
  structureTypeToLabelKey,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import { computePilotReportDataHash } from '@/lib/pilotReport/computePilotReportDataHash';
import {
  type PilotCohortSummary,
  type PilotReportData,
} from '@/lib/pilotReport/types';
import {
  buildCohortOutcome,
  buildRoleFitDistributionLine,
  countNotAssessed,
  formatPilotDateRange,
  rankParticipantsForAppendix,
} from '@/lib/pilotReport/buildPilotReportData';
import { buildPilotReportHtml } from '@/lib/pilotReport/buildPilotReportHtml';
import { buildPilotReportStaticCopy } from '@/lib/pilotReport/buildPilotReportStaticCopy';
import { exportPilotReportPdf } from '@/lib/pilotReport/exportPilotReportPdf';
import { fetchLogoDataUri } from '@/lib/pilotReport/fetchLogoDataUri';
import { buildPilotReportId } from '@/lib/pilotReport/pilotReportId';
import { pilotReportDownloadFilename, pilotReportPdfFilename } from '@/lib/pilotReport/pilotReportFilename';
import {
  PilotReportDocument,
  PilotReportGenerationErrorPanel,
  PilotReportGenerationLoadingPanel,
  PilotReportToolbar,
} from './PilotReportSections';

export function PilotReportContent() {
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
    <PilotReportToolbar
      onBack={() => navigate(-1)}
      onRegenerate={() => void handleRegenerate()}
      onExportPdf={() => void handleExportPdf()}
      onDownloadHtml={handleDownloadHtml}
      isGenerating={isGenerating}
      isExportingPdf={isExportingPdf}
      isReady={isReady}
      canExportPdf={reportData != null}
    />
  );

  if (!isReady) {
    if (isError) {
      return (
        <PilotReportGenerationErrorPanel
          toolbar={toolbar}
          isRTL={isRTL}
          onRegenerate={() => void handleRegenerate()}
        />
      );
    }

    return (
      <PilotReportGenerationLoadingPanel
        toolbar={toolbar}
        isRTL={isRTL}
        progressMessage={progressMessage}
      />
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ backgroundColor: '#eef2f7' }} dir={isRTL ? 'rtl' : 'ltr'}>
      {toolbar}

      <PilotReportDocument
        reportDocRef={reportDocRef}
        staticCopy={staticCopy}
        classroomName={classroom?.name}
        pilotDateRangeDisplay={pilotDateRangeDisplay}
        effectiveAssignmentCount={effectiveAssignmentIds.length}
        cohortSize={data?.students.length ?? 0}
        cohort={cohort}
        notAssessedCount={notAssessedCount}
        roleFitLine={roleFitLine}
        rankedAppendix={rankedAppendix}
        reportId={reportId}
        generatedAtDisplay={generatedAtDisplay}
      />
    </div>
  );
}
