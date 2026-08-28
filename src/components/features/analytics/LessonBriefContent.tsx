import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useClassroomAnalytics, useClassroom } from '@/hooks/queries';
import { useLanguage } from '@/contexts/LanguageContext';
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
import {
  exportLessonBriefPdf,
  lessonBriefPdfFilename,
} from '@/lib/lessonBrief/exportLessonBriefPdf';
import {
  countStudentCompletedAssignmentsInScope,
  lessonBriefDownloadFilename,
  averageFiveD,
  getWeakestDimension,
  classifyStudentStatus,
  normalizeNarrative,
  DIMENSION_ORDER,
  STATUS_PRIORITY_ORDER,
  safeScore,
  LESSON_BRIEF_POLL_MS,
  LESSON_BRIEF_POLL_TIMEOUT_MS,
  type StudentWithNarrative,
  type StudentReportRow,
} from './lessonBriefReportUtils';
import {
  LessonBriefToolbar,
  LessonBriefCoverSection,
  LessonBriefTeachingPrioritiesSection,
  LessonBriefStudentTableSection,
  LessonBriefCoachingCardsSection,
  LessonBriefFooterDisclaimer,
} from './LessonBriefSections';

export function LessonBriefContent() {
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

  const generatedAt = useMemo(
    () =>
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
      <LessonBriefToolbar
        isGenerating={isGenerating}
        isExportingPdf={isExportingPdf}
        onBack={() => navigate(-1)}
        onExportPdf={() => void handleExportPdf()}
        onDownloadHtml={handleDownloadHtml}
      />

      <div id="lesson-brief-content" className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        <LessonBriefCoverSection
          classroomName={classroom?.name}
          generatedAt={generatedAt}
          exportFilterSummary={exportFilterSummary}
          totalStudents={totalStudents}
          totalSubmissions={totalSubmissions}
          averageSubmissionsPerStudent={averageSubmissionsPerStudent}
          assignmentsInScope={effectiveAssignmentIds.length}
        />

        <LessonBriefTeachingPrioritiesSection classPriorityInsights={classPriorityInsights} />

        <LessonBriefStudentTableSection studentRows={studentRows} />

        <LessonBriefCoachingCardsSection isGenerating={isGenerating} studentRows={studentRows} />

        <LessonBriefFooterDisclaimer />
      </div>
    </div>
  );
}
