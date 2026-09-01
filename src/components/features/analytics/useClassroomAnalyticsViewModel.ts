import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { HardSkillAssessmentWithStudent } from '@/types/hard-skills';
import type { FiveDScores, FiveDQedMeasures } from '@/types/models';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClassroomAnalytics } from '@/hooks/queries';
import { build5dNarrativeEvidence, type Analytics5dNarrativeRow } from '@/lib/analytics5dEvidence';
import { buildClassroomAnalyticsCsv } from '@/lib/analyticsExport';
import {
  filterReportableAssignments,
  computeAnalyticsKpiDisplay,
  getAllowedAssignmentIds,
  getClassroomAverage5D,
  getClassroomAverageQedMeasures,
  hasUnplacedAssignments,
  structureTypeToLabelKey,
  scopedStudentLatestScores,
  scopedStudentLatestQedMeasures,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import { isLessonBriefCacheReady } from '@/lib/lessonBriefNarrativeCache';
import { prepareLessonBriefNarratives } from '@/services/lessonBriefPreloadService';
import { ensurePilotReportSnapshot } from '@/services/pilotReportCacheService';

const URL_MOD = 'analyticsModule';
const URL_ASG = 'analyticsAssignment';
const URL_STU = 'analyticsStudent';

export interface ClassroomAnalyticsStudentCollapsible {
  id: string;
  fullName: string;
  feedbackCount: number;
  latestScores: FiveDScores | null;
  latestQedMeasures?: FiveDQedMeasures | null;
  hardSkills: HardSkillAssessmentWithStudent[];
  snapshots: unknown[];
}

export interface UseClassroomAnalyticsViewModelParams {
  classroomId: string;
}

export const useClassroomAnalyticsViewModel = ({
  classroomId,
}: UseClassroomAnalyticsViewModelParams) => {
  const { t } = useTranslation();
  const { isRTL, language: uiLanguage } = useLanguage();
  const analyticsLanguage = uiLanguage === 'he' ? ('he' as const) : ('en' as const);
  const [searchParams, setSearchParams] = useSearchParams();
  const [student5dNarrativeOpen, setStudent5dNarrativeOpen] = useState<Set<string>>(
    () => new Set()
  );

  const [selectedModule, setSelectedModule] = useState<AnalyticsModuleFilter>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');

  const { data, isLoading: loading } = useClassroomAnalytics(classroomId);

  const students = useMemo(() => data?.students ?? [], [data?.students]);
  const allStudents = useMemo(() => data?.allStudents ?? [], [data?.allStudents]);
  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);
  const reportableAssignments = useMemo(
    () => filterReportableAssignments(assignments),
    [assignments]
  );
  const modules = useMemo(() => data?.modules ?? [], [data?.modules]);
  const structureType = data?.structureType;
  const studentCount = data?.studentCount || 0;

  const readUrlRef = useRef(false);
  useEffect(() => {
    if (!data || readUrlRef.current) return;
    readUrlRef.current = true;
    const m = searchParams.get(URL_MOD);
    const a = searchParams.get(URL_ASG);
    const s = searchParams.get(URL_STU);
    if (m) {
      if (m === 'all') {
        setSelectedModule('all');
      } else if (m === 'unplaced' && hasUnplacedAssignments(data.assignments)) {
        setSelectedModule('unplaced');
      } else if (m === 'unplaced') {
        setSelectedModule('all');
      } else if (data.modules?.some((x) => x.id === m)) {
        setSelectedModule(m);
      }
    }
    if (a) {
      if (a === 'all') {
        setSelectedAssignment('all');
      } else if (data.assignments.some((x) => x.id === a)) {
        setSelectedAssignment(a);
      }
    }
    if (s) {
      if (s === 'all') setSelectedStudent('all');
      else if (data.allStudents.some((x) => x.id === s)) setSelectedStudent(s);
    }
  }, [data, searchParams]);

  const structKey = structureTypeToLabelKey(structureType ?? undefined);
  const moduleFilterLabel = t('analytics.filterBySyllabusSection', {
    sectionType: t(`syllabus.${structKey}`),
  });
  const allModulesLabel = t('analytics.allSyllabusSections', {
    sectionType: t(`syllabus.${structKey}`),
  });
  const showUnplaced = hasUnplacedAssignments(reportableAssignments);

  const visibleAssignments = useMemo(() => {
    if (selectedModule === 'all') return reportableAssignments;
    if (selectedModule === 'unplaced') {
      return reportableAssignments.filter((a) => a.syllabusSectionId == null);
    }
    return reportableAssignments.filter((a) => a.syllabusSectionId === selectedModule);
  }, [reportableAssignments, selectedModule]);

  useEffect(() => {
    if (selectedAssignment === 'all') return;
    if (!visibleAssignments.some((a) => a.id === selectedAssignment)) {
      setSelectedAssignment('all');
    }
  }, [visibleAssignments, selectedAssignment]);

  const effectiveAssignmentIds = useMemo(
    () => getAllowedAssignmentIds(reportableAssignments, selectedModule, selectedAssignment),
    [reportableAssignments, selectedModule, selectedAssignment]
  );
  const moduleScopeIds = useMemo(
    () => getAllowedAssignmentIds(reportableAssignments, selectedModule, 'all'),
    [reportableAssignments, selectedModule]
  );

  const isNarrowingView = !(
    selectedModule === 'all' &&
    selectedAssignment === 'all' &&
    selectedStudent === 'all'
  );
  const showRegenerateNote = isNarrowingView;

  const allAssignmentsInScopeLabel =
    selectedModule === 'all' ? t('analytics.allAssignments') : t('analytics.allAssignmentsInScope');

  const writeUrl = useCallback(
    (mod: AnalyticsModuleFilter, asg: string, stu: string) => {
      const next = new URLSearchParams(searchParams);
      next.set(URL_MOD, mod);
      next.set(URL_ASG, asg);
      next.set(URL_STU, stu);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const onModuleChange = (m: AnalyticsModuleFilter) => {
    setSelectedModule(m);
    setSelectedAssignment('all');
    writeUrl(m, 'all', selectedStudent);
  };
  const onAssignmentChange = (a: string) => {
    setSelectedAssignment(a);
    writeUrl(selectedModule, a, selectedStudent);
  };
  const onStudentChange = (s: string) => {
    setSelectedStudent(s);
    writeUrl(selectedModule, selectedAssignment, s);
  };

  const snapshotRowsForAvg = data?.students as
    | {
        id: string;
        snapshots: {
          user_id: string;
          submission_id: string;
          scores: import('@/integrations/supabase/types').Json;
          qed_measures?: import('@/integrations/supabase/types').Json | null;
        }[];
      }[]
    | undefined;

  const classAverage = useMemo(() => {
    if (!data || effectiveAssignmentIds.length === 0) return null;
    return getClassroomAverage5D(
      snapshotRowsForAvg ?? [],
      data.rawSubmissions,
      reportableAssignments,
      selectedModule,
      selectedAssignment,
      selectedStudent,
      data.rawSnapshots
    );
  }, [
    data,
    selectedModule,
    selectedAssignment,
    selectedStudent,
    effectiveAssignmentIds,
    snapshotRowsForAvg,
    reportableAssignments,
  ]);

  const classAverageQed = useMemo(() => {
    if (!data || effectiveAssignmentIds.length === 0) return null;
    return getClassroomAverageQedMeasures(
      snapshotRowsForAvg ?? [],
      data.rawSubmissions,
      reportableAssignments,
      selectedModule,
      selectedAssignment,
      selectedStudent,
      data.rawSnapshots
    );
  }, [
    data,
    selectedModule,
    selectedAssignment,
    selectedStudent,
    effectiveAssignmentIds,
    snapshotRowsForAvg,
    reportableAssignments,
  ]);

  const kpiDisplay = useMemo(
    () =>
      computeAnalyticsKpiDisplay({
        isNarrowingView,
        allAssignments: assignments,
        effectiveAssignmentIds,
        rawFeedback: data?.rawFeedback || [],
        enrolledStudentCount: studentCount,
      }),
    [isNarrowingView, assignments, effectiveAssignmentIds, data?.rawFeedback, studentCount]
  );

  const displayAssignmentCount = kpiDisplay.assignmentCount;
  const displayTotalSubmissions = kpiDisplay.totalSubmissions;
  const displayActiveStudents = kpiDisplay.activeStudents;
  const displayCompletion = kpiDisplay.completionPercent;
  const displayAvgSubmissions =
    studentCount > 0 ? (displayTotalSubmissions / studentCount).toFixed(1) : '0';
  const displayEngagement = displayCompletion;

  const coveredStudents = displayActiveStudents;

  const exportFilterSummary = useMemo(() => {
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
    const stu =
      selectedStudent === 'all'
        ? t('analytics.allStudents')
        : (allStudents.find((s) => s.id === selectedStudent)?.name ?? selectedStudent);
    return [mod, asg, stu].join(' | ');
  }, [
    allModulesLabel,
    selectedModule,
    selectedAssignment,
    selectedStudent,
    modules,
    assignments,
    allStudents,
    t,
  ]);

  const main5dNarrativeId = useMemo(
    () => `5d-main-${selectedModule}-${selectedAssignment}-${selectedStudent}`,
    [selectedModule, selectedAssignment, selectedStudent]
  );

  const sectionTitleResolver = useCallback(
    (syllabusSectionId: string | null) => {
      if (syllabusSectionId == null) return t('analytics.unplacedAssignments');
      return modules.find((m) => m.id === syllabusSectionId)?.title ?? '—';
    },
    [modules, t]
  );

  useEffect(() => {
    if (!data || studentCount === 0) return;
    void ensurePilotReportSnapshot({
      classroomId,
      scopeModule: 'all',
      scopeAssignment: 'all',
      language: analyticsLanguage,
      analyticsData: data,
      sectionTitleResolver,
      recommendationFallback: t('pilotReport.recommendationFallback'),
      force: false,
    });
  }, [classroomId, data, studentCount, analyticsLanguage, sectionTitleResolver, t]);

  const main5dNarrativeEvidence = useMemo(() => {
    if (!data) {
      return { evidenceText: '', sourceCount: 0 };
    }
    return build5dNarrativeEvidence({
      context: selectedStudent === 'all' ? 'class_avg' : 'student_avg',
      allowedAssignmentIds: effectiveAssignmentIds,
      allStudents: data.students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
      })),
      assignmentRefs: data.assignments,
      singleStudentId: selectedStudent === 'all' ? undefined : selectedStudent,
      sectionTitleResolver,
    });
  }, [data, selectedStudent, effectiveAssignmentIds, sectionTitleResolver]);

  const studentList5dEvidenceById = useMemo(() => {
    if (!data) {
      return new Map<string, { evidenceText: string; sourceCount: number }>();
    }
    const allowed = getAllowedAssignmentIds(reportableAssignments, selectedModule, 'all');
    const m = new Map<string, { evidenceText: string; sourceCount: number }>();
    const allStudentsNarr = data.students.map((st) => ({
      id: st.id,
      fullName: st.fullName,
      narrativeRows: (st as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
    }));
    for (const s of data.students) {
      m.set(
        s.id,
        build5dNarrativeEvidence({
          context: 'student_avg',
          allowedAssignmentIds: allowed,
          allStudents: allStudentsNarr,
          assignmentRefs: data.assignments,
          singleStudentId: s.id,
          sectionTitleResolver,
        })
      );
    }
    return m;
  }, [data, reportableAssignments, selectedModule, sectionTitleResolver]);

  const perStudentForExport = useMemo(() => {
    if (!data || effectiveAssignmentIds.length === 0) return [];
    const rows: { name: string; scores: FiveDScores }[] = [];
    for (const s of data.students) {
      const scores = scopedStudentLatestScores(
        s.snapshots,
        data.rawSubmissions,
        effectiveAssignmentIds
      );
      if (scores) rows.push({ name: s.fullName, scores });
    }
    return rows;
  }, [data, effectiveAssignmentIds]);

  const handleExportCsv = useCallback(() => {
    if (!data) return;
    const structLabel = structureType ? t(`syllabus.${structKey}`) : '—';
    const csv = buildClassroomAnalyticsCsv({
      classroomId,
      exportedAtIso: new Date().toISOString(),
      structureTypeLabel: structLabel,
      filterSummary: exportFilterSummary,
      assignmentCountInScope: effectiveAssignmentIds.length,
      enrolledStudents: studentCount,
      coveredStudents,
      classAverage5D: classAverage,
      kpi: {
        totalSubmissions: displayTotalSubmissions,
        activeStudents: displayActiveStudents,
        completionPercent: displayCompletion,
        avgSubmissions: displayAvgSubmissions,
      },
      perStudentRows: perStudentForExport,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${classroomId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    data,
    classroomId,
    structureType,
    t,
    structKey,
    exportFilterSummary,
    effectiveAssignmentIds.length,
    studentCount,
    coveredStudents,
    classAverage,
    displayTotalSubmissions,
    displayActiveStudents,
    displayCompletion,
    displayAvgSubmissions,
    perStudentForExport,
  ]);

  const handleExportLessonBriefPdf = useCallback(() => {
    if (!data || studentCount === 0) return;

    const params = new URLSearchParams();
    if (selectedModule !== 'all') params.set('analyticsModule', selectedModule);
    if (selectedAssignment !== 'all') params.set('analyticsAssignment', selectedAssignment);

    const url = `/teacher/classroom/${classroomId}/lesson-brief?${params.toString()}`;
    window.open(url, '_blank');
  }, [data, studentCount, classroomId, selectedModule, selectedAssignment]);

  useEffect(() => {
    if (!data || studentCount === 0 || effectiveAssignmentIds.length === 0) return;
    if (isLessonBriefCacheReady(classroomId, selectedModule, selectedAssignment)) return;

    const controller = new AbortController();

    void prepareLessonBriefNarratives({
      classroomId,
      module: selectedModule,
      assignment: selectedAssignment,
      language: analyticsLanguage,
      filterSummary: exportFilterSummary,
      students: data.students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        snapshots: s.snapshots,
        narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
      })),
      assignments: data.assignments,
      rawSubmissions: data.rawSubmissions,
      effectiveAssignmentIds,
      sectionTitleResolver,
      signal: controller.signal,
    }).catch(() => {
      // Errors logged in service; background preload is silent on analytics page
    });

    return () => {
      controller.abort();
    };
  }, [
    data,
    studentCount,
    classroomId,
    selectedModule,
    selectedAssignment,
    effectiveAssignmentIds,
    analyticsLanguage,
    exportFilterSummary,
    sectionTitleResolver,
  ]);

  const handleOpenPilotReport = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedModule !== 'all') params.set('analyticsModule', selectedModule);
    if (selectedAssignment !== 'all') params.set('analyticsAssignment', selectedAssignment);
    window.open(`/teacher/classroom/${classroomId}/pilot-report?${params.toString()}`, '_blank');
  }, [classroomId, selectedModule, selectedAssignment]);

  const studentsForCollapsible = useMemo((): ClassroomAnalyticsStudentCollapsible[] => {
    if (selectedModule === 'all') {
      return students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        feedbackCount: s.feedbackCount,
        latestScores: s.latestScores as FiveDScores | null,
        latestQedMeasures: (s as { latestQedMeasures?: FiveDQedMeasures | null }).latestQedMeasures,
        hardSkills: (s.hardSkills ?? []) as HardSkillAssessmentWithStudent[],
        snapshots: s.snapshots,
      }));
    }
    const scopeIds = getAllowedAssignmentIds(reportableAssignments, selectedModule, 'all');
    if (scopeIds.length === 0) {
      return students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        latestScores: null,
        latestQedMeasures: null,
        feedbackCount: 0,
        hardSkills: [],
        snapshots: s.snapshots,
      }));
    }
    const allow = new Set(scopeIds);
    return students.map((s) => {
      const fb = (data?.rawFeedback || []).filter(
        (f) => f.student_id === s.id && allow.has(f.assignment_id)
      );
      const latest = data
        ? scopedStudentLatestScores(s.snapshots, data.rawSubmissions, scopeIds)
        : null;
      const latestQed = data
        ? scopedStudentLatestQedMeasures(s.snapshots, data.rawSubmissions, scopeIds)
        : null;
      const hardFiltered =
        s.hardSkills?.filter((h) => h.assignment_id && allow.has(h.assignment_id as string)) || [];
      return {
        id: s.id,
        fullName: s.fullName,
        feedbackCount: fb.length,
        latestScores: latest,
        latestQedMeasures: latestQed,
        hardSkills: hardFiltered as HardSkillAssessmentWithStudent[],
        snapshots: s.snapshots,
      };
    });
  }, [students, data, selectedModule, reportableAssignments]);

  const craForModuleWithAllAssignments =
    selectedModule !== 'all' && selectedAssignment === 'all' && selectedStudent !== 'all';

  const showTopCra = selectedStudent !== 'all' && effectiveAssignmentIds.length > 0;

  const showAllStudentsCraList =
    selectedStudent === 'all' && selectedAssignment !== 'all' && effectiveAssignmentIds.length > 0;

  const chartSubtext = (() => {
    if (selectedAssignment !== 'all') {
      return t('classroomAnalytics.scoresFor', {
        assignment: assignments.find((a) => a.id === selectedAssignment)?.title,
      });
    }
    if (selectedModule === 'unplaced') {
      return t('classroomAnalytics.averageScoresUnplaced');
    }
    if (selectedModule !== 'all') {
      const mod = modules.find((m) => m.id === selectedModule);
      return t('classroomAnalytics.averageScoresInSection', { section: mod?.title ?? '—' });
    }
    return t('classroomAnalytics.averageScoresAcross');
  })();

  const showEmptyModuleScope = effectiveAssignmentIds.length === 0 && selectedModule !== 'all';

  const toggleStudent5dNarrative = useCallback((studentId: string, open: boolean) => {
    setStudent5dNarrativeOpen((prev) => {
      const next = new Set(prev);
      if (open) next.add(studentId);
      else next.delete(studentId);
      return next;
    });
  }, []);

  return {
    loading,
    data,
    isRTL,
    analyticsLanguage,
    classroomId,
    structKey,
    structureType,
    studentCount,
    students,
    allStudents,
    assignments,
    modules,
    showUnplaced,
    selectedModule,
    selectedAssignment,
    selectedStudent,
    moduleFilterLabel,
    allModulesLabel,
    allAssignmentsInScopeLabel,
    visibleAssignments,
    effectiveAssignmentIds,
    moduleScopeIds,
    showRegenerateNote,
    onModuleChange,
    onAssignmentChange,
    onStudentChange,
    classAverage,
    classAverageQed,
    displayAssignmentCount,
    displayTotalSubmissions,
    displayActiveStudents,
    displayCompletion,
    displayAvgSubmissions,
    displayEngagement,
    coveredStudents,
    exportFilterSummary,
    main5dNarrativeId,
    sectionTitleResolver,
    main5dNarrativeEvidence,
    studentList5dEvidenceById,
    handleExportCsv,
    handleExportLessonBriefPdf,
    handleOpenPilotReport,
    studentsForCollapsible,
    craForModuleWithAllAssignments,
    showTopCra,
    showAllStudentsCraList,
    chartSubtext,
    showEmptyModuleScope,
    student5dNarrativeOpen,
    toggleStudent5dNarrative,
  };
};

export type ClassroomAnalyticsViewModel = ReturnType<typeof useClassroomAnalyticsViewModel>;
