import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useClassroomAnalytics, useClassroom } from '@/hooks/queries';
import { useLanguage } from '@/contexts/LanguageContext';
import { FiveDChart } from '@/components/FiveDChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getLessonBriefPreloadStatus,
  getLessonBriefStudentNarrativesCache,
  isLessonBriefCacheReady,
} from '@/lib/lessonBriefNarrativeCache';
import {
  filterReportableAssignments,
  getAllowedAssignmentIds,
  getClassroomAverage5D,
  structureTypeToLabelKey,
  scopedStudentLatestScores,
  scopedStudentLatestQedMeasures,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import { build5dNarrativeEvidence, type Analytics5dNarrativeRow } from '@/lib/analytics5dEvidence';
import { invokeExplainAnalytics5d, type Analytics5dNarrativeResult } from '@/services/analytics5dExplainService';
import { runPool } from '@/lib/asyncPool';
import type { TFunction } from 'i18next';
import type { FiveDScores, FiveDQedMeasures } from '@/types/models';
import {
  exportLessonBriefPdf,
  lessonBriefPdfFilename,
} from '@/lib/lessonBrief/exportLessonBriefPdf';

type SubmissionLike = {
  student_id: string;
  assignment_id: string;
  status: string;
};

/** How many scoped assignments have at least one completed submission by this student. */
function countStudentCompletedAssignmentsInScope(
  studentId: string,
  submissions: SubmissionLike[],
  assignmentIdsInScope: string[],
): number {
  if (assignmentIdsInScope.length === 0) return 0;
  const scopeSet = new Set(assignmentIdsInScope);
  const done = new Set<string>();
  for (const s of submissions) {
    if (s.student_id !== studentId) continue;
    if (!scopeSet.has(s.assignment_id)) continue;
    if (s.status !== 'completed') continue;
    done.add(s.assignment_id);
  }
  return done.size;
}

type StudentWithNarrative = {
  id: string;
  name: string;
  completedInScope: number;
  assignmentsInScope: number;
  scores: FiveDScores | null;
  qedMeasures: FiveDQedMeasures | null;
  narrative: Analytics5dNarrativeResult | null;
};

type StudentStatusKey = 'highPriority' | 'needsSupport' | 'monitor' | 'stable';

type DimensionKey = keyof FiveDScores;

type StudentNarrativeFields = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  improvement: string[];
};

type StudentReportRow = StudentWithNarrative & {
  completionRatio: number;
  averageScore: number | null;
  weakestDimension: DimensionKey | null;
  weakestScore: number | null;
  status: StudentStatusKey;
  normalizedNarrative: StudentNarrativeFields;
};

const DIMENSION_ORDER: DimensionKey[] = ['vision', 'values', 'thinking', 'connection', 'action'];

const STATUS_PRIORITY_ORDER: Record<StudentStatusKey, number> = {
  highPriority: 0,
  needsSupport: 1,
  monitor: 2,
  stable: 3,
};

const STATUS_I18N_KEY: Record<StudentStatusKey, string> = {
  highPriority: 'analytics.lessonBrief.statusHighPriority',
  needsSupport: 'analytics.lessonBrief.statusNeedsSupport',
  monitor: 'analytics.lessonBrief.statusMonitor',
  stable: 'analytics.lessonBrief.statusStable',
};

const LESSON_BRIEF_POLL_MS = 500;
const LESSON_BRIEF_POLL_TIMEOUT_MS = 60_000;

function lessonBriefDownloadFilename(courseName: string | undefined | null): string {
  const shortName =
    (courseName || 'course')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'course';
  const date = new Date().toISOString().slice(0, 10);
  return `lesson_brief_${shortName}_${date}.html`;
}

function safeScore(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function averageFiveD(scores: FiveDScores): number {
  const total = DIMENSION_ORDER.reduce((sum, key) => sum + safeScore(scores[key]), 0);
  return total / DIMENSION_ORDER.length;
}

function getWeakestDimension(scores: FiveDScores): { key: DimensionKey; value: number } {
  let weakest: DimensionKey = DIMENSION_ORDER[0];
  let weakestValue = safeScore(scores[weakest]);

  for (const key of DIMENSION_ORDER.slice(1)) {
    const value = safeScore(scores[key]);
    if (value < weakestValue) {
      weakest = key;
      weakestValue = value;
    }
  }

  return { key: weakest, value: weakestValue };
}

function classifyStudentStatus(completionRatio: number, weakestScore: number): StudentStatusKey {
  if (completionRatio < 0.35 || weakestScore < 3.5) return 'highPriority';
  if (completionRatio < 0.55 || weakestScore < 5) return 'needsSupport';
  if (completionRatio < 0.75 || weakestScore < 6.5) return 'monitor';
  return 'stable';
}

function asList(value: string[] | null | undefined): string[] {
  if (!value || value.length === 0) return [];
  return value.map((item) => item.trim()).filter(Boolean);
}

function normalizeNarrative(
  narrative: Analytics5dNarrativeResult | null,
  studentName: string,
  weakestDimension: DimensionKey | null,
  t: TFunction,
): StudentNarrativeFields {
  const summary =
    narrative?.scopeSummary?.trim() ||
    t('analytics.lessonBrief.defaultSummary', { name: studentName });

  const strengths = asList(narrative?.strengths);
  const weaknesses = asList(narrative?.weaknesses);
  const improvement = asList(narrative?.nextSteps);

  const weakestLabel = weakestDimension
    ? t(`dimensions.${weakestDimension}.label`)
    : t('analytics.lessonBrief.dash');

  return {
    summary,
    strengths:
      strengths.length > 0
        ? strengths
        : [t('analytics.lessonBrief.defaultStrength')],
    weaknesses:
      weaknesses.length > 0
        ? weaknesses
        : [
            t('analytics.lessonBrief.defaultWeakness', {
              dimension: weakestLabel.toLowerCase(),
            }),
          ],
    improvement:
      improvement.length > 0
        ? improvement
        : [
            t('analytics.lessonBrief.defaultImprovement', {
              dimension: weakestLabel.toLowerCase(),
            }),
          ],
  };
}

export default function LessonBriefPage() {
  const { id: classroomId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL, language: uiLanguage } = useLanguage();
  const analyticsLanguage = uiLanguage === 'he' ? 'he' : 'en';

  const { data, isLoading } = useClassroomAnalytics(classroomId!);
  const { data: classroom } = useClassroom(classroomId);

  const [studentData, setStudentData] = useState<StudentWithNarrative[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const selectedModule = (searchParams.get('analyticsModule') as AnalyticsModuleFilter) || 'all';
  const selectedAssignment = searchParams.get('analyticsAssignment') || 'all';

  const assignments = data?.assignments || [];
  const reportableAssignments = useMemo(
    () => filterReportableAssignments(assignments),
    [assignments],
  );
  const modules = data?.modules || [];

  const effectiveAssignmentIds = useMemo(
    () => getAllowedAssignmentIds(reportableAssignments, selectedModule, selectedAssignment),
    [reportableAssignments, selectedModule, selectedAssignment]
  );

  const exportFilterSummary = useMemo(() => {
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

  const classAverage = useMemo(() => {
    if (!data || effectiveAssignmentIds.length === 0) return null;
    return getClassroomAverage5D(
      data.students as any,
      data.rawSubmissions,
      reportableAssignments,
      selectedModule,
      selectedAssignment,
      'all',
      data.rawSnapshots
    );
  }, [data, selectedModule, selectedAssignment, effectiveAssignmentIds, reportableAssignments]);

  const sectionTitleResolver = useCallback(
    (syllabusSectionId: string | null) => {
      if (syllabusSectionId == null) return t('analytics.unplacedAssignments');
      return modules.find((m) => m.id === syllabusSectionId)?.title ?? '—';
    },
    [modules, t]
  );

  const generatedAt = useMemo(    () =>
      new Date().toLocaleString(uiLanguage === 'he' ? 'he-IL' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [uiLanguage]
  );

  const submissionScopeSet = useMemo(() => new Set(effectiveAssignmentIds), [effectiveAssignmentIds]);

  const submissionsInScope = useMemo(
    () => (data?.rawSubmissions || []).filter((s) => submissionScopeSet.has(s.assignment_id)),
    [data?.rawSubmissions, submissionScopeSet]
  );

  const totalStudents = data?.studentCount ?? data?.students.length ?? 0;
  const totalSubmissions = submissionsInScope.length;
  const averageSubmissionsPerStudent = totalStudents > 0 ? totalSubmissions / totalStudents : 0;

  const scopedClassCompletionRatio =
    totalStudents > 0 && effectiveAssignmentIds.length > 0
      ? studentData.reduce((sum, row) => sum + row.completedInScope, 0) /
        (totalStudents * effectiveAssignmentIds.length)
      : 0;

  const studentRows = useMemo<StudentReportRow[]>(() => {
    const rows = studentData.map((student) => {
      const completionRatio =
        student.assignmentsInScope > 0 ? student.completedInScope / student.assignmentsInScope : 0;

      const weakestDimensionData = student.scores ? getWeakestDimension(student.scores) : null;
      const weakestDimension = weakestDimensionData?.key ?? null;
      const weakestScore = weakestDimensionData?.value ?? null;
      const averageScore = student.scores ? averageFiveD(student.scores) : null;
      const status = classifyStudentStatus(completionRatio, weakestScore ?? 0);
      const normalizedNarrative = normalizeNarrative(
        student.narrative,
        student.name,
        weakestDimension,
        t,
      );

      return {
        ...student,
        completionRatio,
        averageScore,
        weakestDimension,
        weakestScore,
        status,
        normalizedNarrative,
      };
    });

    return rows.sort((a, b) => {
      const statusDiff = STATUS_PRIORITY_ORDER[a.status] - STATUS_PRIORITY_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [studentData, t]);

  const classPriorityInsights = useMemo(() => {
    const weakestDimensions = classAverage
      ? [...DIMENSION_ORDER]
          .sort((a, b) => safeScore(classAverage[a]) - safeScore(classAverage[b]))
          .slice(0, 2)
      : [];

    const highPriorityCount = studentRows.filter((row) => row.status === 'highPriority').length;
    const needsSupportCount = studentRows.filter((row) => row.status === 'needsSupport').length;

    const firstWeakDimension = weakestDimensions[0];
    const secondWeakDimension = weakestDimensions[1];
    const firstWeakLabel = firstWeakDimension
      ? t(`dimensions.${firstWeakDimension}.label`)
      : t('dimensions.vision.label');
    const secondWeakLabel = secondWeakDimension
      ? t(`dimensions.${secondWeakDimension}.label`)
      : t('dimensions.thinking.label');

    const firstWeakScore = firstWeakDimension && classAverage ? safeScore(classAverage[firstWeakDimension]) : 0;
    const secondWeakScore =
      secondWeakDimension && classAverage ? safeScore(classAverage[secondWeakDimension]) : 0;

    return [
      {
        title: t('analytics.lessonBrief.priorityTitle1', { dimension: firstWeakLabel }),
        body: t('analytics.lessonBrief.priorityBody1', {
          score: firstWeakScore.toFixed(1),
          dimension: firstWeakLabel,
        }),
      },
      {
        title: t('analytics.lessonBrief.priorityTitle2', { dimension: secondWeakLabel }),
        body: t('analytics.lessonBrief.priorityBody2', {
          score: secondWeakScore.toFixed(1),
          dimension: secondWeakLabel,
        }),
      },
      {
        title: t('analytics.lessonBrief.priorityTitle3'),
        body: t('analytics.lessonBrief.priorityBody3', {
          count: highPriorityCount + needsSupportCount,
          completion: (scopedClassCompletionRatio * 100).toFixed(0),
        }),
      },
    ];
  }, [classAverage, studentRows, scopedClassCompletionRatio, t]);

  useEffect(() => {
    if (!data || !classroomId || effectiveAssignmentIds.length === 0) return;

    let isMounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const buildBaseStudents = () => {
      const denom = effectiveAssignmentIds.length;
      const list = [...data.students];
      list.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));

      return list.map((st) => ({
        id: st.id,
        name: st.fullName,
        completedInScope: countStudentCompletedAssignmentsInScope(
          st.id,
          st.submissions ?? [],
          effectiveAssignmentIds
        ),
        assignmentsInScope: denom,
        scores: scopedStudentLatestScores(st.snapshots, data.rawSubmissions, effectiveAssignmentIds),
        qedMeasures: scopedStudentLatestQedMeasures(st.snapshots, data.rawSubmissions, effectiveAssignmentIds),
        narrative: null as Analytics5dNarrativeResult | null,
      }));
    };

    const applyCachedNarratives = () => {
      const cached = getLessonBriefStudentNarrativesCache(
        classroomId,
        selectedModule,
        selectedAssignment
      );
      const baseStudents = buildBaseStudents();
      const narrativeById = new Map(
        (cached?.narratives ?? []).map((entry) => [entry.studentId, entry.narrative])
      );

      setStudentData(
        baseStudents.map((st) => ({
          ...st,
          narrative: narrativeById.get(st.id) ?? null,
        }))
      );
      setIsGenerating(false);
    };

    const waitForPreload = (): Promise<boolean> =>
      new Promise((resolve) => {
        if (isLessonBriefCacheReady(classroomId, selectedModule, selectedAssignment)) {
          resolve(true);
          return;
        }

        setIsGenerating(true);
        const startedAt = Date.now();

        pollTimer = setInterval(() => {
          if (!isMounted) return;

          if (isLessonBriefCacheReady(classroomId, selectedModule, selectedAssignment)) {
            if (pollTimer) clearInterval(pollTimer);
            resolve(true);
            return;
          }

          const status = getLessonBriefPreloadStatus(classroomId, selectedModule, selectedAssignment);
          if (status === 'error') {
            if (pollTimer) clearInterval(pollTimer);
            resolve(false);
            return;
          }

          if (Date.now() - startedAt >= LESSON_BRIEF_POLL_TIMEOUT_MS) {
            if (pollTimer) clearInterval(pollTimer);
            resolve(false);
          }
        }, LESSON_BRIEF_POLL_MS);
      });

    const generateNarratives = async () => {
      setIsGenerating(true);

      const baseStudents = buildBaseStudents();

      const allStudentsForEvidence = data.students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
      }));

      const results = await runPool(baseStudents, 4, async (row) => {
        if (!row.scores) return null;
        try {
          const evidence = build5dNarrativeEvidence({
            context: 'student_avg',
            allowedAssignmentIds: effectiveAssignmentIds,
            allStudents: allStudentsForEvidence,
            assignmentRefs: reportableAssignments,
            singleStudentId: row.id,
            sectionTitleResolver,
          });

          return await invokeExplainAnalytics5d({
            classroomId,
            context: 'student_avg',
            language: analyticsLanguage,
            scores: row.scores,
            filterSummary: exportFilterSummary,
            studentName: row.name,
            evidenceText: evidence.evidenceText || undefined,
            evidenceSourceCount: evidence.sourceCount,
            brief: true,
          });
        } catch (e) {
          console.error('Failed to generate narrative for', row.name, e);
          return null;
        }
      });

      if (isMounted) {
        setStudentData(baseStudents.map((st, i) => ({ ...st, narrative: results[i] })));
        setIsGenerating(false);
      }
    };

    const loadStudentNarratives = async () => {
      if (isLessonBriefCacheReady(classroomId, selectedModule, selectedAssignment)) {
        applyCachedNarratives();
        return;
      }

      const status = getLessonBriefPreloadStatus(classroomId, selectedModule, selectedAssignment);
      if (status === 'loading') {
        const ready = await waitForPreload();
        if (!isMounted) return;
        if (ready) {
          applyCachedNarratives();
          return;
        }
      }

      await generateNarratives();
    };

    void loadStudentNarratives();

    return () => {
      isMounted = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [
    data,
    classroomId,
    effectiveAssignmentIds,
    selectedModule,
    selectedAssignment,
    analyticsLanguage,
    exportFilterSummary,
    sectionTitleResolver,
    reportableAssignments,
  ]);

  const handleExportPdf = useCallback(async () => {
    if (isGenerating) return;
    setIsExportingPdf(true);
    try {
      window.scrollTo(0, 0);
      await exportLessonBriefPdf({
        contentRootId: 'lesson-brief-content',
        filename: lessonBriefPdfFilename(classroom?.name),
      });
    } catch {
      toast.error(t('analytics.lessonBrief.exportError'));
    } finally {
      setIsExportingPdf(false);
    }
  }, [isGenerating, classroom?.name, t]);

  const handleDownloadHtml = () => {
    const content = document.getElementById('lesson-brief-content')?.innerHTML;
    if (!content) return;

    const html = `
<!DOCTYPE html>
<html lang="${uiLanguage}" dir="${isRTL ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t('analytics.lessonBrief.title')} - ${classroom?.name || ''}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .break-inside-avoid { break-inside: avoid; }
    }
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 2rem; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = lessonBriefDownloadFilename(classroom?.name);
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Navigation Bar (No Print) */}
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
              onClick={() => void handleExportPdf()}
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
              onClick={handleDownloadHtml}
            >
              <Download className="h-4 w-4 me-1.5" aria-hidden />
              {t('common.download', 'Download HTML')}
            </Button>
          </div>        </div>
      </div>

      <div id="lesson-brief-content" className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
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
              <p className="font-semibold">{classroom?.name || t('analytics.lessonBrief.dash')}</p>
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
              <p className="text-2xl font-semibold mt-1">{effectiveAssignmentIds.length}</p>
            </div>
          </div>
        </section>

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

        <section className="pdf-block space-y-4 break-inside-avoid">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {t('analytics.lessonBrief.studentTableTitle')}
              </h2>
              <p className="text-sm text-slate-600">{t('analytics.lessonBrief.studentTableDescription')}</p>
            </div>
          </div>

          <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">{t('analytics.lessonBrief.columnStudent')}</th>
                      <th className="px-4 py-3 font-semibold">{t('analytics.lessonBrief.columnProgress')}</th>
                      <th className="px-4 py-3 font-semibold">{t('analytics.lessonBrief.column5dScores')}</th>
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
                          {student.scores ? (
                            <span className="text-xs leading-relaxed">
                              {DIMENSION_ORDER.map((dimension) => (
                                <span key={dimension}>
                                  {t(`dimensions.${dimension}.abbrev`)}:
                                  {safeScore(student.scores![dimension]).toFixed(1)}
                                  {dimension !== 'action' ? ' · ' : ''}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="text-slate-400">{t('analytics.lessonBrief.dash')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {student.weakestDimension ? t(`dimensions.${student.weakestDimension}.label`) : t('analytics.lessonBrief.dash')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

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

        <div className="pdf-block text-center text-xs text-slate-400 pt-8 border-t border-slate-200">
          {t('analytics.lessonBrief.footerDisclaimer')}
        </div>
      </div>
    </div>
  );
}
