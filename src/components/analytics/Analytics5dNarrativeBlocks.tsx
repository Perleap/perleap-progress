import type { ReactNode } from 'react';
import { FiveDChart } from '@/components/FiveDChart';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useAnalytics5dNarrative, type Analytics5dNarrativeContext } from '@/hooks/queries/useAnalytics5dNarrative';
import type { FiveDScores } from '@/types/models';

type Lang = 'en' | 'he';

function NarrativeFraming({
  isLoading,
  isError,
  scopeSummary,
  isRTL,
  evidenceSourceCount,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  scopeSummary: string | null | undefined;
  isRTL: boolean;
  /**
   * Count of text excerpts used in the evidence bundle for this call (0 = scores-and-filters only).
   * Omitted: do not show an evidence status line.
   */
  evidenceSourceCount?: number;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const showEvidenceStatus = !isLoading && !isError && evidenceSourceCount != null;
  return (
    <div className="space-y-3">
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          {t('analytics.narrative.loading')}
        </div>
      )}
      {isError && <p className="text-xs text-destructive">{t('analytics.narrative.error')}</p>}
      {scopeSummary && !isLoading && (
        <p
          className={`text-sm text-muted-foreground leading-relaxed ${
            isRTL ? 'text-right' : 'text-left'
          }`}
        >
          {scopeSummary}
        </p>
      )}
      {showEvidenceStatus && evidenceSourceCount! > 0 ? (
        <p
          className={`text-xs text-muted-foreground/80 ${isRTL ? 'text-right' : 'text-left'}`}
        >
          {t('analytics.narrative.basedOnSources', { count: evidenceSourceCount! })}
        </p>
      ) : null}
      {showEvidenceStatus && evidenceSourceCount === 0 ? (
        <p
          className={`text-xs text-muted-foreground/80 ${isRTL ? 'text-right' : 'text-left'}`}
        >
          {t('analytics.narrative.scoresOnlyHint')}
        </p>
      ) : null}
      <div className={isLoading ? 'opacity-60 pointer-events-none' : ''}>{children}</div>
    </div>
  );
}

export function MainAnalytics5dNarrativeBlock({
  classroomId,
  classAverage,
  filterSummary,
  language,
  selectedStudent,
  studentName,
  isRTL,
  enabled,
  narrativeId,
  evidenceText,
  evidenceSourceCount,
}: {
  classroomId: string;
  classAverage: FiveDScores;
  filterSummary: string;
  language: Lang;
  selectedStudent: string;
  studentName?: string;
  isRTL: boolean;
  enabled: boolean;
  narrativeId: string;
  evidenceText?: string;
  evidenceSourceCount?: number;
}) {
  const context: Analytics5dNarrativeContext = selectedStudent === 'all' ? 'class_avg' : 'student_avg';
  const { data, isLoading, isError } = useAnalytics5dNarrative(
    {
      classroomId,
      context,
      language,
      scores: classAverage,
      filterSummary,
      studentName: selectedStudent === 'all' ? undefined : studentName,
      evidenceText,
      evidenceSourceCount,
    },
    { enabled: enabled && !!classroomId, narrativeId },
  );
  return (
    <NarrativeFraming
      isLoading={isLoading}
      isError={isError}
      scopeSummary={data?.scopeSummary}
      isRTL={isRTL}
      evidenceSourceCount={evidenceSourceCount ?? 0}
    >
      <FiveDChart scores={classAverage} explanations={data?.explanations ?? null} />
    </NarrativeFraming>
  );
}

export function CompareSide5dNarrativeBlock({
  classroomId,
  sideScores,
  filterSummary,
  language,
  compareLabelA,
  compareLabelB,
  peerScores,
  isRTL,
  enabled,
  narrativeId,
  evidenceText,
  evidenceSourceCount,
}: {
  classroomId: string;
  sideScores: FiveDScores;
  filterSummary: string;
  language: Lang;
  compareLabelA: string;
  compareLabelB: string;
  peerScores: FiveDScores;
  isRTL: boolean;
  enabled: boolean;
  narrativeId: string;
  evidenceText?: string;
  evidenceSourceCount?: number;
}) {
  const { data, isLoading, isError } = useAnalytics5dNarrative(
    {
      classroomId,
      context: 'module_compare',
      language,
      scores: sideScores,
      filterSummary,
      compareLabelA,
      compareLabelB,
      peerScores,
      evidenceText,
      evidenceSourceCount,
    },
    { enabled: enabled && !!classroomId, narrativeId },
  );
  return (
    <NarrativeFraming
      isLoading={isLoading}
      isError={isError}
      scopeSummary={data?.scopeSummary}
      isRTL={isRTL}
      evidenceSourceCount={evidenceSourceCount ?? 0}
    >
      <FiveDChart scores={sideScores} explanations={data?.explanations ?? null} />
    </NarrativeFraming>
  );
}

export function StudentList5dNarrativeBlock({
  classroomId,
  studentId,
  studentName,
  scores,
  filterSummary,
  language,
  isOpen,
  isRTL,
  enabled,
  evidenceText,
  evidenceSourceCount,
}: {
  classroomId: string;
  studentId: string;
  studentName: string;
  scores: FiveDScores;
  filterSummary: string;
  language: Lang;
  isOpen: boolean;
  isRTL: boolean;
  enabled: boolean;
  evidenceText?: string;
  evidenceSourceCount?: number;
}) {
  const { data, isLoading, isError } = useAnalytics5dNarrative(
    {
      classroomId,
      context: 'student_avg',
      language,
      scores,
      filterSummary,
      studentName,
      evidenceText,
      evidenceSourceCount,
    },
    { enabled: enabled && isOpen, narrativeId: `student-5d-${studentId}` },
  );
  return (
    <NarrativeFraming
      isLoading={isLoading}
      isError={isError}
      scopeSummary={data?.scopeSummary}
      isRTL={isRTL}
      evidenceSourceCount={evidenceSourceCount ?? 0}
    >
      <FiveDChart scores={scores} explanations={data?.explanations ?? null} />
    </NarrativeFraming>
  );
}
