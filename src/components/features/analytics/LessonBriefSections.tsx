import { ArrowLeft, Download, FileDown, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DIMENSION_ORDER,
  STATUS_I18N_KEY,
  safeScore,
  type ClassPriorityInsight,
  type StudentReportRow,
} from './lessonBriefReportUtils';
import { FiveDChart } from '@/components/features/analytics/FiveDChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type LessonBriefToolbarProps = {
  isGenerating: boolean;
  isExportingPdf: boolean;
  onBack: () => void;
  onExportPdf: () => void;
  onDownloadHtml: () => void;
};

export const LessonBriefToolbar = ({
  isGenerating,
  isExportingPdf,
  onBack,
  onExportPdf,
  onDownloadHtml,
}: LessonBriefToolbarProps) => {
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
            onClick={onExportPdf}
            disabled={isGenerating || isExportingPdf}
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
          >
            <Download className="h-4 w-4 me-1.5" aria-hidden />
            {t('common.download', 'Download HTML')}
          </Button>
        </div>
      </div>
    </div>
  );
};

type LessonBriefCoverSectionProps = {
  classroomName: string | undefined;
  generatedAt: string;
  exportFilterSummary: string;
  totalStudents: number;
  totalSubmissions: number;
  averageSubmissionsPerStudent: number;
  assignmentsInScope: number;
};

export const LessonBriefCoverSection = ({
  classroomName,
  generatedAt,
  exportFilterSummary,
  totalStudents,
  totalSubmissions,
  averageSubmissionsPerStudent,
  assignmentsInScope,
}: LessonBriefCoverSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="pdf-block rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 text-white px-6 md:px-8 py-8 shadow-lg break-inside-avoid">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-blue-100 font-semibold">
          {t('analytics.lessonBrief.coverEyebrow')}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t('analytics.lessonBrief.title')}
        </h1>
        <p className="text-blue-100 text-sm md:text-base">{t('analytics.lessonBrief.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 text-sm">
        <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-blue-100">{t('analytics.lessonBrief.classroom')}</p>
          <p className="font-semibold">{classroomName || t('analytics.lessonBrief.dash')}</p>
        </div>
        <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-blue-100">{t('analytics.lessonBrief.generatedDateLabel')}</p>
          <p className="font-semibold">{generatedAt}</p>
        </div>
        <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-blue-100">{t('analytics.lessonBrief.currentFiltersLabel')}</p>
          <p className="font-semibold">{exportFilterSummary}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
          <p className="text-blue-100 text-xs uppercase tracking-wide">
            {t('analytics.lessonBrief.totalStudentsLabel')}
          </p>
          <p className="text-2xl font-semibold mt-1">{totalStudents}</p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
          <p className="text-blue-100 text-xs uppercase tracking-wide">
            {t('analytics.lessonBrief.totalSubmissionsLabel')}
          </p>
          <p className="text-2xl font-semibold mt-1">{totalSubmissions}</p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
          <p className="text-blue-100 text-xs uppercase tracking-wide">
            {t('analytics.lessonBrief.avgSubmissionsLabel')}
          </p>
          <p className="text-2xl font-semibold mt-1">{averageSubmissionsPerStudent.toFixed(1)}</p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
          <p className="text-blue-100 text-xs uppercase tracking-wide">
            {t('analytics.lessonBrief.assignmentsInScopeLabel')}
          </p>
          <p className="text-2xl font-semibold mt-1">{assignmentsInScope}</p>
        </div>
      </div>
    </section>
  );
};

type LessonBriefTeachingPrioritiesSectionProps = {
  classPriorityInsights: ClassPriorityInsight[];
};

export const LessonBriefTeachingPrioritiesSection = ({
  classPriorityInsights,
}: LessonBriefTeachingPrioritiesSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="pdf-block space-y-4 break-inside-avoid">
      <h2 className="text-2xl font-semibold text-slate-900">
        {t('analytics.lessonBrief.teachingPrioritiesTitle')}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {classPriorityInsights.map((priority, index) => (
          <Card key={priority.title} className="rounded-2xl border border-slate-200 shadow-sm">
            <CardContent className="p-5 space-y-2">
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
                {index + 1}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{priority.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{priority.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

type LessonBriefStudentTableSectionProps = {
  studentRows: StudentReportRow[];
};

export const LessonBriefStudentTableSection = ({
  studentRows,
}: LessonBriefStudentTableSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="pdf-block space-y-4 break-inside-avoid">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            {t('analytics.lessonBrief.studentTableTitle')}
          </h2>
          <p className="text-sm text-slate-600">
            {t('analytics.lessonBrief.studentTableDescription')}
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">
                    {t('analytics.lessonBrief.columnStudent')}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t('analytics.lessonBrief.columnProgress')}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t('analytics.lessonBrief.column5dScores')}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t('analytics.lessonBrief.columnLowestDimension')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((student) => (
                  <tr key={student.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-3 font-medium text-slate-800">{student.name}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {student.completedInScope} / {student.assignmentsInScope}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {(() => {
                        const scores = student.scores;
                        if (!scores) {
                          return (
                            <span className="text-slate-400">
                              {t('analytics.lessonBrief.dash')}
                            </span>
                          );
                        }
                        return (
                          <span className="text-xs leading-relaxed">
                            {DIMENSION_ORDER.map((dimension) => (
                              <span key={dimension}>
                                {t(`dimensions.${dimension}.abbrev`)}:
                                {safeScore(scores[dimension]).toFixed(1)}
                                {dimension !== 'action' ? ' · ' : ''}
                              </span>
                            ))}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {student.weakestDimension
                        ? t(`dimensions.${student.weakestDimension}.label`)
                        : t('analytics.lessonBrief.dash')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

type LessonBriefCoachingCardsSectionProps = {
  isGenerating: boolean;
  studentRows: StudentReportRow[];
};

export const LessonBriefCoachingCardsSection = ({
  isGenerating,
  studentRows,
}: LessonBriefCoachingCardsSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="space-y-6">
      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 no-print print:hidden">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-slate-500">{t('analytics.lessonBrief.preparingSummaries')}</p>
        </div>
      )}

      {!isGenerating &&
        studentRows.map((student, index) => (
          <div
            key={student.id}
            className="pdf-block lesson-brief-student-card rounded-2xl border-2 border-slate-300 bg-white overflow-hidden"
            data-pdf-fit-page="true"
          >
            {index === 0 && (
              <div className="px-6 pt-6 pb-4 border-b border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-900">
                  {t('analytics.lessonBrief.coachingCardsTitle')}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {t('analytics.lessonBrief.coachingCardsDescription')}
                </p>
              </div>
            )}

            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-xl font-semibold text-slate-900">{student.name}</h3>
              <p className="text-sm text-slate-600 mt-1">
                {t('analytics.lessonBrief.completedMeta', {
                  completed: student.completedInScope,
                  total: student.assignmentsInScope,
                })}
                {student.averageScore != null
                  ? ` · ${t('analytics.lessonBrief.avg5dMeta', { score: student.averageScore.toFixed(1) })}`
                  : ''}
                {` · ${t(STATUS_I18N_KEY[student.status])}`}
              </p>
            </div>

            <div className="px-6 py-3 border-b border-slate-100 lesson-brief-radar-chart">
              {student.scores ? (
                <FiveDChart
                  scores={student.scores}
                  qedMeasures={student.qedMeasures}
                  explanations={student.narrative?.explanations ?? null}
                  showLabels={false}
                  layerControlsLayout="stacked"
                  height={260}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                  {t('analytics.lessonBrief.narrativeNoScores')}
                </div>
              )}
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border border-slate-200 bg-white p-3 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    {t('analytics.lessonBrief.studentSummaryLabel')}
                  </p>
                  <p className="text-sm text-slate-900 leading-relaxed">
                    {student.normalizedNarrative.summary}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-emerald-700/80 mb-1">
                    {t('analytics.lessonBrief.strengthsLabel')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-emerald-950/80">
                    {student.normalizedNarrative.strengths.map((item, itemIndex) => (
                      <li key={`${student.id}-strength-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-amber-700/80 mb-1">
                    {t('analytics.lessonBrief.weaknessesLabel')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-amber-950/80">
                    {student.normalizedNarrative.weaknesses.map((item, itemIndex) => (
                      <li key={`${student.id}-weakness-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 md:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-blue-700/80 mb-1">
                    {t('analytics.lessonBrief.improvementLabel')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-blue-950/80">
                    {student.normalizedNarrative.improvement.map((item, itemIndex) => (
                      <li key={`${student.id}-improvement-${itemIndex}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ))}
    </section>
  );
};

export const LessonBriefFooterDisclaimer = () => {
  const { t } = useTranslation();

  return (
    <div className="pdf-block text-center text-xs text-slate-400 pt-8 border-t border-slate-200">
      {t('analytics.lessonBrief.footerDisclaimer')}
    </div>
  );
};
