import { useState, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Printer, Download, Loader2 } from 'lucide-react';
import { useClassroomAnalytics, useClassroom } from '@/hooks/queries';
import { analytics5dNarrativeKeys, useAnalytics5dNarrative } from '@/hooks/queries/useAnalytics5dNarrative';
import { useLanguage } from '@/contexts/LanguageContext';
import { FiveDChart } from '@/components/FiveDChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DIMENSION_CONFIG } from '@/config/constants';
import { getLessonBriefClassNarrativeCache } from '@/lib/lessonBriefNarrativeCache';
import {
  getAllowedAssignmentIds,
  getClassroomAverage5D,
  structureTypeToLabelKey,
  scopedStudentLatestScores,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import { build5dNarrativeEvidence, type Analytics5dNarrativeRow } from '@/lib/analytics5dEvidence';
import { invokeExplainAnalytics5d, type Analytics5dNarrativeResult } from '@/services/analytics5dExplainService';
import { runPool } from '@/lib/asyncPool';
import type { FiveDScores } from '@/types/models';

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
  narrative: Analytics5dNarrativeResult | null;
};

type StudentStatus = 'High priority' | 'Needs support' | 'Monitor' | 'Stable';

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
  status: StudentStatus;
  normalizedNarrative: StudentNarrativeFields;
};

const DIMENSION_ORDER: DimensionKey[] = ['vision', 'values', 'thinking', 'connection', 'action'];

const STATUS_PRIORITY_ORDER: Record<StudentStatus, number> = {
  'High priority': 0,
  'Needs support': 1,
  Monitor: 2,
  Stable: 3,
};

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

function ClassSnapshotSection({
  classroomId,
  classAverage,
  filterSummary,
  language,
  isRTL,
  narrativeId,
  evidenceText,
  evidenceSourceCount,
}: {
  classroomId: string;
  classAverage: FiveDScores;
  filterSummary: string;
  language: 'en' | 'he';
  isRTL: boolean;
  narrativeId: string;
  evidenceText?: string;
  evidenceSourceCount: number;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useAnalytics5dNarrative(
    {
      classroomId,
      context: 'class_avg',
      language,
      scores: classAverage,
      filterSummary,
      evidenceText,
      evidenceSourceCount,
    },
    { enabled: !!classroomId, narrativeId }
  );

  const explanations = data?.explanations ?? null;
  const showEvidenceStatus = !isLoading && !isError;

  return (
    <Card className="rounded-2xl border border-slate-200 shadow-sm break-inside-avoid">
      <CardHeader>
        <CardTitle className="text-base">{t('analytics.classAverage')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            {t('analytics.narrative.loading')}
          </div>
        )}
        {isError && <p className="text-xs text-destructive">{t('analytics.narrative.error')}</p>}
        {data?.scopeSummary && !isLoading && (
          <p className={`text-sm text-muted-foreground leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
            {data.scopeSummary}
          </p>
        )}
        {showEvidenceStatus && evidenceSourceCount > 0 ? (
          <p className={`text-xs text-muted-foreground/80 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('analytics.narrative.basedOnSources', { count: evidenceSourceCount })}
          </p>
        ) : null}
        {showEvidenceStatus && evidenceSourceCount === 0 ? (
          <p className={`text-xs text-muted-foreground/80 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('analytics.narrative.scoresOnlyHint')}
          </p>
        ) : null}

        <div className={isLoading ? 'opacity-60 pointer-events-none' : ''}>
          <div className="grid grid-cols-1 xl:grid-cols-[1.75fr_0.9fr] gap-6 items-center">
            <div className="min-h-[420px] md:min-h-[520px] w-full">
              <FiveDChart
                scores={classAverage}
                explanations={explanations}
                showLabels={false}
                height={520}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">
              {DIMENSION_ORDER.map((dimension) => {
                const config = DIMENSION_CONFIG[dimension];
                const value = safeScore(classAverage[dimension]);
                const barWidth = `${Math.max(0, Math.min(100, value * 10))}%`;
                const explanation =
                  explanations?.[dimension] || t(`dimensions.${dimension}.description`);
                return (
                  <Card key={dimension} className="rounded-2xl border border-slate-200 shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: config.color }}
                          />
                          <p className="text-sm font-semibold text-slate-800">{config.label}</p>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{value.toFixed(1)}/10</p>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{explanation}</p>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: barWidth, backgroundColor: config.color }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
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

function classifyStudentStatus(completionRatio: number, weakestScore: number): StudentStatus {
  if (completionRatio < 0.35 || weakestScore < 3.5) return 'High priority';
  if (completionRatio < 0.55 || weakestScore < 5) return 'Needs support';
  if (completionRatio < 0.75 || weakestScore < 6.5) return 'Monitor';
  return 'Stable';
}

function asList(value: string[] | null | undefined): string[] {
  if (!value || value.length === 0) return [];
  return value.map((item) => item.trim()).filter(Boolean);
}

function normalizeNarrative(
  narrative: Analytics5dNarrativeResult | null,
  studentName: string,
  weakestDimension: DimensionKey | null
): StudentNarrativeFields {
  const summary =
    narrative?.scopeSummary?.trim() ||
    `${studentName} has limited scoped evidence. Use this card as a quick check-in baseline for the next lesson.`;

  const strengths = asList(narrative?.strengths);
  const weaknesses = asList(narrative?.weaknesses);
  const improvement = asList(narrative?.nextSteps);

  const weakestLabel = weakestDimension ? DIMENSION_CONFIG[weakestDimension].label : 'one key 5D area';

  return {
    summary,
    strengths:
      strengths.length > 0
        ? strengths
        : ['Keeps participating enough to provide evidence for coaching decisions.'],
    weaknesses:
      weaknesses.length > 0
        ? weaknesses
        : [`Needs stronger consistency in ${weakestLabel.toLowerCase()} to improve lesson outcomes.`],
    improvement:
      improvement.length > 0
        ? improvement
        : [`Set one concrete, measurable next step focused on ${weakestLabel.toLowerCase()}.`],
  };
}

export default function LessonBriefPage() {
  const { id: classroomId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { isRTL, language: uiLanguage } = useLanguage();
  const analyticsLanguage = uiLanguage === 'he' ? 'he' : 'en';

  const { data, isLoading } = useClassroomAnalytics(classroomId!);
  const { data: classroom } = useClassroom(classroomId);

  const [studentData, setStudentData] = useState<StudentWithNarrative[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedModule = (searchParams.get('analyticsModule') as AnalyticsModuleFilter) || 'all';
  const selectedAssignment = searchParams.get('analyticsAssignment') || 'all';

  const assignments = data?.assignments || [];
  const modules = data?.modules || [];

  const effectiveAssignmentIds = useMemo(
    () => getAllowedAssignmentIds(assignments, selectedModule, selectedAssignment),
    [assignments, selectedModule, selectedAssignment]
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
      data.assignments,
      selectedModule,
      selectedAssignment,
      'all',
      data.rawSnapshots
    );
  }, [data, selectedModule, selectedAssignment, effectiveAssignmentIds]);

  const classNarrativeId = useMemo(
    () => `5d-main-${selectedModule}-${selectedAssignment}-all`,
    [selectedModule, selectedAssignment]
  );

  const sectionTitleResolver = useCallback(
    (syllabusSectionId: string | null) => {
      if (syllabusSectionId == null) return t('analytics.unplacedAssignments');
      return modules.find((m) => m.id === syllabusSectionId)?.title ?? '—';
    },
    [modules, t]
  );

  const classNarrativeEvidence = useMemo(() => {
    if (!data) return { evidenceText: '', sourceCount: 0 };
    return build5dNarrativeEvidence({
      context: 'class_avg',
      allowedAssignmentIds: effectiveAssignmentIds,
      allStudents: data.students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
      })),
      assignmentRefs: data.assignments,
      sectionTitleResolver,
    });
  }, [data, effectiveAssignmentIds, sectionTitleResolver]);

  const cachedClassNarrative = useMemo(() => {
    if (!classroomId) return null;
    return getLessonBriefClassNarrativeCache(classroomId, selectedModule, selectedAssignment);
  }, [classroomId, selectedModule, selectedAssignment]);

  useLayoutEffect(() => {
    if (!cachedClassNarrative?.narrative || !classAverage || !classroomId) return;
    const key = analytics5dNarrativeKeys.one({
      classroomId,
      context: 'class_avg',
      language: analyticsLanguage,
      scores: classAverage,
      filterSummary: exportFilterSummary,
      evidenceText: classNarrativeEvidence.evidenceText || undefined,
      evidenceSourceCount: classNarrativeEvidence.sourceCount,
      narrativeId: classNarrativeId,
    });
    if (!queryClient.getQueryData(key)) {
      queryClient.setQueryData(key, cachedClassNarrative.narrative);
    }
  }, [
    cachedClassNarrative,
    classAverage,
    classroomId,
    analyticsLanguage,
    exportFilterSummary,
    classNarrativeEvidence,
    classNarrativeId,
    queryClient,
  ]);

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
      const normalizedNarrative = normalizeNarrative(student.narrative, student.name, weakestDimension);

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
  }, [studentData]);

  const classPriorityInsights = useMemo(() => {
    const weakestDimensions = classAverage
      ? [...DIMENSION_ORDER]
          .sort((a, b) => safeScore(classAverage[a]) - safeScore(classAverage[b]))
          .slice(0, 2)
      : [];

    const highPriorityCount = studentRows.filter((row) => row.status === 'High priority').length;
    const needsSupportCount = studentRows.filter((row) => row.status === 'Needs support').length;

    const firstWeakDimension = weakestDimensions[0];
    const secondWeakDimension = weakestDimensions[1];
    const firstWeakLabel = firstWeakDimension ? DIMENSION_CONFIG[firstWeakDimension].label : 'Vision';
    const secondWeakLabel = secondWeakDimension ? DIMENSION_CONFIG[secondWeakDimension].label : 'Thinking';

    const firstWeakScore = firstWeakDimension && classAverage ? safeScore(classAverage[firstWeakDimension]) : 0;
    const secondWeakScore =
      secondWeakDimension && classAverage ? safeScore(classAverage[secondWeakDimension]) : 0;

    return [
      {
        title: `Prioritize ${firstWeakLabel} routines at lesson launch`,
        body: `Class average is ${firstWeakScore.toFixed(1)}/10 in ${firstWeakLabel}. Begin with a quick model of strong work criteria and one concrete success example.`,
      },
      {
        title: `Use structured peer moments to strengthen ${secondWeakLabel}`,
        body: `${secondWeakLabel} is at ${secondWeakScore.toFixed(1)}/10. Add a short peer explanation checkpoint so students justify choices before submitting.`,
      },
      {
        title: `Target intervention for at-risk learners`,
        body: `${highPriorityCount + needsSupportCount} students are flagged as High priority or Needs support, and scoped assignment completion is ${(scopedClassCompletionRatio * 100).toFixed(0)}%. End class with one personalized next step tied to each learner's lowest dimension.`,
      },
    ];
  }, [classAverage, studentRows, scopedClassCompletionRatio]);

  useEffect(() => {
    if (!data || effectiveAssignmentIds.length === 0) return;

    let isMounted = true;

    const generateNarratives = async () => {
      setIsGenerating(true);
      
      const denom = effectiveAssignmentIds.length;
      const list = [...data.students];
      list.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));

      const baseStudents = list.map((st) => ({
        id: st.id,
        name: st.fullName,
        completedInScope: countStudentCompletedAssignmentsInScope(
          st.id,
          st.submissions ?? [],
          effectiveAssignmentIds
        ),
        assignmentsInScope: denom,
        scores: scopedStudentLatestScores(st.snapshots, data.rawSubmissions, effectiveAssignmentIds),
        narrative: null,
      }));

      const allStudentsForEvidence = data.students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
      }));

      const sectionTitleResolverForStudent = sectionTitleResolver;

      const results = await runPool(baseStudents, 4, async (row) => {
        if (!row.scores) return null;
        try {
          const evidence = build5dNarrativeEvidence({
            context: 'student_avg',
            allowedAssignmentIds: effectiveAssignmentIds,
            allStudents: allStudentsForEvidence,
            assignmentRefs: data.assignments,
            singleStudentId: row.id,
            sectionTitleResolver: sectionTitleResolverForStudent,
          });

          return await invokeExplainAnalytics5d({
            classroomId: classroomId!,
            context: 'student_avg',
            language: analyticsLanguage,
            scores: row.scores,
            filterSummary: exportFilterSummary,
            studentName: row.name,
            evidenceText: evidence.evidenceText || undefined,
            evidenceSourceCount: evidence.sourceCount,
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

    generateNarratives();

    return () => {
      isMounted = false;
    };
  }, [data, effectiveAssignmentIds, classroomId, analyticsLanguage, exportFilterSummary, sectionTitleResolver]);

  const handlePrint = () => {
    window.print();
  };

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
              onClick={handlePrint}
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
            >
              <Download className="h-4 w-4 me-1.5" aria-hidden />
              {t('common.download', 'Download HTML')}
            </Button>
          </div>        </div>
      </div>

      <div id="lesson-brief-content" className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        <section className="rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 text-white px-6 md:px-8 py-8 shadow-lg break-inside-avoid">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-blue-100 font-semibold">Perleap Lesson Brief</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Lesson Preparation Report</h1>
            <p className="text-blue-100 text-sm md:text-base">
              Teacher-facing overview with class focus areas and student coaching guidance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 text-sm">
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-blue-100">Course</p>
              <p className="font-semibold">{classroom?.name || t('analytics.lessonBrief.dash')}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-blue-100">Generated date</p>
              <p className="font-semibold">{generatedAt}</p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-blue-100">Current filters</p>
              <p className="font-semibold">{exportFilterSummary}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-blue-100 text-xs uppercase tracking-wide">Total students</p>
              <p className="text-2xl font-semibold mt-1">{totalStudents}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-blue-100 text-xs uppercase tracking-wide">Total submissions</p>
              <p className="text-2xl font-semibold mt-1">{totalSubmissions}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-blue-100 text-xs uppercase tracking-wide">Avg submissions / student</p>
              <p className="text-2xl font-semibold mt-1">{averageSubmissionsPerStudent.toFixed(1)}</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-blue-100 text-xs uppercase tracking-wide">Assignments in scope</p>
              <p className="text-2xl font-semibold mt-1">{effectiveAssignmentIds.length}</p>
            </div>
          </div>
        </section>

        <section className="space-y-4 break-inside-avoid">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Class Snapshot</h2>
              <p className="text-sm text-slate-600">Class-level 5D profile with quick dimension-level interpretation.</p>
            </div>
          </div>

          {classAverage && effectiveAssignmentIds.length > 0 ? (
            <ClassSnapshotSection
              classroomId={classroomId!}
              classAverage={classAverage}
              filterSummary={exportFilterSummary}
              language={analyticsLanguage}
              isRTL={isRTL}
              narrativeId={classNarrativeId}
              evidenceText={classNarrativeEvidence.evidenceText}
              evidenceSourceCount={classNarrativeEvidence.sourceCount}
            />
          ) : (
            <Card className="rounded-2xl border border-slate-200 shadow-sm">
              <CardContent className="p-6 text-sm text-slate-600">
                No class-level 5D data is available for the selected scope.
              </CardContent>
            </Card>
          )}
        </section>

        <section className="space-y-4 break-inside-avoid">
          <h2 className="text-2xl font-semibold text-slate-900">Teaching Priorities</h2>
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

        <section className="space-y-4 break-inside-avoid">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Student Table</h2>
              <p className="text-sm text-slate-600">Compact classroom scan for completion, 5D performance, and lowest dimension.</p>
            </div>
          </div>

          <Card className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Completed / Scope</th>
                      <th className="px-4 py-3 font-semibold">5D scores</th>
                      <th className="px-4 py-3 font-semibold">Lowest dimension</th>
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
                                  {DIMENSION_CONFIG[dimension].label.slice(0, 1)}:
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
                          {student.weakestDimension ? DIMENSION_CONFIG[student.weakestDimension].label : t('analytics.lessonBrief.dash')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Student Coaching Cards</h2>
              <p className="text-sm text-slate-600">Use these cards to plan targeted support before the next lesson.</p>
            </div>
          </div>

          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 no-print print:hidden">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-muted-foreground">{t('analytics.lessonBrief.preparingSummaries')}</p>
            </div>
          )}

          {!isGenerating && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {studentRows.map((student) => (
                <Card
                  key={student.id}
                  className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden break-inside-avoid"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl font-semibold text-slate-900">{student.name}</CardTitle>
                        <p className="text-sm text-slate-600 mt-1">
                          {student.completedInScope} / {student.assignmentsInScope} completed
                          {student.averageScore != null ? ` · Avg 5D ${student.averageScore.toFixed(1)}/10` : ''}
                          {` · ${student.status}`}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4">
                    {student.scores ? (
                      <div className="space-y-2">
                        {DIMENSION_ORDER.map((dimension) => {
                          const value = safeScore(student.scores?.[dimension] ?? 0);
                          return (
                            <div key={dimension} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-slate-700">{DIMENSION_CONFIG[dimension].label}</span>
                                <span className="text-slate-900 font-semibold">{value.toFixed(1)}/10</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, value * 10))}%`,
                                    backgroundColor: DIMENSION_CONFIG[dimension].color,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                        {t('analytics.lessonBrief.narrativeNoScores')}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-border bg-card p-3 md:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">summary</p>
                        <p className="text-sm text-foreground leading-relaxed">{student.normalizedNarrative.summary}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-emerald-700/80 mb-1">strengths</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-emerald-950/80">
                          {student.normalizedNarrative.strengths.map((item, index) => (
                            <li key={`${student.id}-strength-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-amber-700/80 mb-1">weaknesses</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-amber-950/80">
                          {student.normalizedNarrative.weaknesses.map((item, index) => (
                            <li key={`${student.id}-weakness-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 md:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-blue-700/80 mb-1">improvement</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-blue-950/80">
                          {student.normalizedNarrative.improvement.map((item, index) => (
                            <li key={`${student.id}-improvement-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="text-center text-xs text-slate-400 pt-8 border-t border-slate-200">
          {t('analytics.lessonBrief.footerDisclaimer')}
        </div>
      </div>
    </div>
  );
}
