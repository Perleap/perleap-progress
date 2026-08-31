import { ArrowLeft, Download, FileDown, Loader2, RefreshCw } from 'lucide-react';
import { useMemo, type ReactNode, type Ref, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BADGE_SIZE_PX,
  BLUE,
  SUMMARY_COLUMN_STYLES,
  badgeCircleStyle,
  readinessPillStyle,
} from './pilotReportViewUtils';
import type { buildCohortOutcome } from '@/lib/pilotReport/buildPilotReportData';
import { Button } from '@/components/ui/button';
import {
  buildPieChartSvg,
  READINESS_PIE_COLORS,
  type PieChartSegment,
} from '@/lib/pilotReport/buildPieChartSvg';
import { formatCompletionPercent } from '@/lib/pilotReport/buildPilotReportData';
import {
  PILOT_DIMENSION_KEYS,
  PILOT_READINESS_VALUES,
  type PilotParticipantRow,
  type PilotReportStaticCopy,
} from '@/lib/pilotReport/types';

export const SectionBar = ({ num, title }: { num?: string; title: string }) => {
  return (
    <div
      className="text-center text-sm font-bold text-white py-2.5 px-4 tracking-wide"
      style={{ backgroundColor: BLUE.primary }}
    >
      {num ? <span className="opacity-80 text-xs me-1.5">{num}</span> : null}
      {title}
    </div>
  );
};

export const SectionNote = ({ children }: { children: React.ReactNode }) => {
  return (
    <p
      className="text-xs px-4 py-2 border-b"
      style={{ color: BLUE.primary, backgroundColor: '#f7fafd', borderColor: BLUE.border }}
    >
      {children}
    </p>
  );
};

export const MethodologyLegend = ({ staticCopy }: { staticCopy: PilotReportStaticCopy }) => {
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
};

export const ReadinessPieChart = ({
  cohort,
  staticCopy,
  notAssessedCount,
}: {
  cohort: ReturnType<typeof buildCohortOutcome>;
  staticCopy: PilotReportStaticCopy;
  notAssessedCount: number;
}) => {
  const svg = useMemo(() => {
    const segments: PieChartSegment[] = PILOT_READINESS_VALUES.map((key) => ({
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
};

export const ParticipantCardBadges = ({
  participant,
  staticCopy,
}: {
  participant: PilotParticipantRow & { rank: number };
  staticCopy: PilotReportStaticCopy;
}) => {
  const readinessLabel = participant.readiness
    ? staticCopy.readinessLabels[participant.readiness]
    : staticCopy.noData;
  const completionPct = formatCompletionPercent(
    participant.completedInScope,
    participant.assignmentsInScope
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
};

export const AppendixSummaryGrid = ({
  participant,
  staticCopy,
}: {
  participant: PilotParticipantRow;
  staticCopy: PilotReportStaticCopy;
}) => {
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
};

export const MiniDimensionBars = ({
  dimensions,
  labels,
}: {
  dimensions: NonNullable<PilotParticipantRow['dimensions']>;
  labels: Record<(typeof PILOT_DIMENSION_KEYS)[number], string>;
}) => {
  return (
    <div className="space-y-1.5 my-2">
      {PILOT_DIMENSION_KEYS.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <span className="w-36 shrink-0 text-[0.65rem] font-semibold" style={{ color: BLUE.dark }}>
            {labels[key]}
          </span>
          <div
            className="flex-1 h-2 rounded-sm overflow-hidden"
            style={{ backgroundColor: '#dde8f4' }}
          >
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
};

type PilotReportToolbarProps = {
  onBack: () => void;
  onRegenerate: () => void;
  onExportPdf: () => void;
  onDownloadHtml: () => void;
  isGenerating: boolean;
  isExportingPdf: boolean;
  isReady: boolean;
  canExportPdf: boolean;
};

export const PilotReportToolbar = ({
  onBack,
  onRegenerate,
  onExportPdf,
  onDownloadHtml,
  isGenerating,
  isExportingPdf,
  isReady,
  canExportPdf,
}: PilotReportToolbarProps) => {
  const { t } = useTranslation();

  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border no-print print:hidden">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={onRegenerate}
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
            onClick={onExportPdf}
            disabled={!canExportPdf || !isReady || isExportingPdf}
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
            onClick={onDownloadHtml}
            disabled={!isReady}
          >
            <Download className="h-4 w-4 me-1.5" aria-hidden />
            {t('common.download', 'Download HTML')}
          </Button>
        </div>
      </div>
    </div>
  );
};

type PilotReportGenerationErrorPanelProps = {
  toolbar: ReactNode;
  isRTL: boolean;
  onRegenerate: () => void;
};

export const PilotReportGenerationErrorPanel = ({
  toolbar,
  isRTL,
  onRegenerate,
}: PilotReportGenerationErrorPanelProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#eef2f7' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
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
          <Button type="button" className="mt-6 rounded-lg" onClick={onRegenerate}>
            <RefreshCw className="h-4 w-4 me-1.5" aria-hidden />
            {t('pilotReport.retry')}
          </Button>
        </div>
      </div>
    </div>
  );
};

type PilotReportGenerationLoadingPanelProps = {
  toolbar: ReactNode;
  isRTL: boolean;
  progressMessage: string;
};

export const PilotReportGenerationLoadingPanel = ({
  toolbar,
  isRTL,
  progressMessage,
}: PilotReportGenerationLoadingPanelProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#eef2f7' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
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
};

type PilotReportDocumentProps = {
  reportDocRef: RefObject<HTMLDivElement | null>;
  staticCopy: PilotReportStaticCopy;
  classroomName: string | undefined;
  pilotDateRangeDisplay: string;
  effectiveAssignmentCount: number;
  cohortSize: number;
  cohort: ReturnType<typeof buildCohortOutcome>;
  notAssessedCount: number;
  roleFitLine: string | null;
  rankedAppendix: (PilotParticipantRow & { rank: number })[];
  reportId: string;
  generatedAtDisplay: string;
};

export const PilotReportDocument = ({
  reportDocRef,
  staticCopy,
  classroomName,
  pilotDateRangeDisplay,
  effectiveAssignmentCount,
  cohortSize,
  cohort,
  notAssessedCount,
  roleFitLine,
  rankedAppendix,
  reportId,
  generatedAtDisplay,
}: PilotReportDocumentProps) => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div
        id="pilot-report-doc"
        ref={reportDocRef as Ref<HTMLDivElement>}
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
            {classroomName || '—'}
          </p>
          <div className="text-xs text-slate-500 mt-2 leading-relaxed space-y-0.5">
            {pilotDateRangeDisplay ? <p>{pilotDateRangeDisplay}</p> : null}
            <p>
              {staticCopy.labelAssignmentsInScope}: {effectiveAssignmentCount}
            </p>
            <p>
              {staticCopy.labelCohortSize}: {cohortSize}
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
          <p
            className="text-sm px-4 py-2.5 border-b text-slate-700"
            style={{ borderColor: BLUE.border }}
          >
            <span className="font-semibold" style={{ color: BLUE.dark }}>
              {staticCopy.cohortParticipants}:
            </span>{' '}
            {cohort.participantsAssessed} of {cohort.participantsTotal}
          </p>
          {roleFitLine ? (
            <p
              className="text-sm px-4 py-2.5 border-b text-slate-700"
              style={{ borderColor: BLUE.border }}
            >
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
                      <p
                        className="text-[0.65rem] font-bold uppercase tracking-wide mb-1"
                        style={{ color: BLUE.dark }}
                      >
                        {staticCopy.appendixObservedSignals}
                      </p>
                      <MiniDimensionBars
                        dimensions={p.dimensions}
                        labels={staticCopy.dimensionLabels}
                      />
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
  );
};
