import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HardSkillsAssessmentTable } from './HardSkillsAssessmentTable';
import {
  MainAnalytics5dNarrativeBlock,
  CompareSide5dNarrativeBlock,
  StudentList5dNarrativeBlock,
} from '@/components/analytics/Analytics5dNarrativeBlocks';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronDown, Users, BookOpen, FileText, CheckCircle2, BarChart3, Filter, Sparkles, Trophy, Target, Info, Download, GitCompare } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { buildClassroomAnalyticsCsv } from '@/lib/analyticsExport';
import { useClassroomAnalytics } from '@/hooks/queries';
import { NuanceInsightsTable } from '@/components/features/analytics/NuanceInsightsTable';
import { AnalyticsFilterControls } from '@/components/features/analytics/AnalyticsFilterControls';
import { RegenerateScoresButton } from '@/components/RegenerateScoresButton';
import {
  getAllowedAssignmentIds,
  getClassroomAverage5D,
  hasUnplacedAssignments,
  structureTypeToLabelKey,
  scopedStudentLatestScores,
  type AnalyticsModuleFilter,
} from '@/lib/analyticsScope';
import {
  build5dNarrativeEvidence,
  type Analytics5dNarrativeRow,
} from '@/lib/analytics5dEvidence';
// `useClassroomAnalytics` and 5D LLM evidence (incl. optional teacher notes) are teacher-only; do
// not reuse this data path for student-facing analytics.
import type { FiveDScores } from '@/types/models';

const URL_MOD = 'analyticsModule';
const URL_ASG = 'analyticsAssignment';
const URL_STU = 'analyticsStudent';

interface ClassroomAnalyticsProps {
  classroomId: string;
  onRegenerateComplete?: () => void;
}

export function ClassroomAnalytics({ classroomId, onRegenerateComplete }: ClassroomAnalyticsProps) {
  const { t } = useTranslation();
  const { isRTL, language: uiLanguage } = useLanguage();
  const analyticsLanguage = uiLanguage === 'he' ? 'he' as const : 'en' as const;
  const [searchParams, setSearchParams] = useSearchParams();
  const [student5dNarrativeOpen, setStudent5dNarrativeOpen] = useState<Set<string>>(() => new Set());

  const [selectedModule, setSelectedModule] = useState<AnalyticsModuleFilter>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');

  const { data, isLoading: loading } = useClassroomAnalytics(classroomId);

  const students = data?.students || [];
  const allStudents = data?.allStudents || [];
  const assignments = data?.assignments || [];
  const modules = data?.modules || [];
  const structureType = data?.structureType;
  const studentCount = data?.studentCount || 0;
  const fullAssignmentCount = data?.assignmentCount || 0;

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
  const showUnplaced = hasUnplacedAssignments(assignments);
  const canCompareSections = modules.length + (showUnplaced ? 1 : 0) >= 2;

  const labelForCompareModule = (id: string) => {
    if (!id) return '';
    if (id === 'unplaced') return t('analytics.unplacedAssignments');
    return modules.find((m) => m.id === id)?.title ?? id;
  };

  const visibleAssignments = useMemo(() => {
    if (selectedModule === 'all') return assignments;
    if (selectedModule === 'unplaced') {
      return assignments.filter((a) => a.syllabusSectionId == null);
    }
    return assignments.filter((a) => a.syllabusSectionId === selectedModule);
  }, [assignments, selectedModule]);

  useEffect(() => {
    if (selectedAssignment === 'all') return;
    if (!visibleAssignments.some((a) => a.id === selectedAssignment)) {
      setSelectedAssignment('all');
    }
  }, [visibleAssignments, selectedAssignment]);

  const effectiveAssignmentIds = useMemo(
    () => getAllowedAssignmentIds(assignments, selectedModule, selectedAssignment),
    [assignments, selectedModule, selectedAssignment],
  );
  const effectiveSet = useMemo(() => new Set(effectiveAssignmentIds), [effectiveAssignmentIds]);
  const moduleScopeIds = useMemo(
    () => getAllowedAssignmentIds(assignments, selectedModule, 'all'),
    [assignments, selectedModule],
  );

  const isNarrowingView = !(
    selectedModule === 'all' && selectedAssignment === 'all' && selectedStudent === 'all'
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
    [searchParams, setSearchParams],
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

  const classAverage = useMemo(() => {
    if (!data || effectiveAssignmentIds.length === 0) return null;
    return getClassroomAverage5D(
      data.students as { id: string; snapshots: { user_id: string; submission_id: string; scores: import('@/integrations/supabase/types').Json }[] }[],
      data.rawSubmissions,
      data.assignments,
      selectedModule,
      selectedAssignment,
      selectedStudent,
      data.rawSnapshots,
    );
  }, [data, selectedModule, selectedAssignment, selectedStudent, effectiveAssignmentIds]);

  const scopedFeedback = useMemo(() => {
    if (!data) return { count: 0, activeStudents: 0 };
    const rows = (data.rawFeedback || []).filter((f) => effectiveSet.has(f.assignment_id));
    const stu = new Set(rows.map((r) => r.student_id));
    return { count: rows.length, activeStudents: stu.size };
  }, [data, effectiveSet]);

  const displayAssignmentCount = isNarrowingView
    ? effectiveAssignmentIds.length
    : fullAssignmentCount;
  const displayTotalSubmissions = isNarrowingView ? scopedFeedback.count
    : students.reduce((s, st) => s + st.feedbackCount, 0);
  const displayActiveStudents = isNarrowingView
    ? scopedFeedback.activeStudents
    : students.filter((s) => s.feedbackCount > 0).length;
  const displayCompletion =
    studentCount > 0 ? Math.round((displayActiveStudents / studentCount) * 100) : 0;
  const displayAvgSubmissions = studentCount > 0 ? (displayTotalSubmissions / studentCount).toFixed(1) : '0';
  const displayEngagement = displayCompletion;

  const coveredStudents = displayActiveStudents;

  const compareAvgA = useMemo(() => {
    if (!data || !compareA) return null;
    return getClassroomAverage5D(
      data.students as { id: string; snapshots: { user_id: string; submission_id: string; scores: import('@/integrations/supabase/types').Json }[] }[],
      data.rawSubmissions,
      data.assignments,
      compareA as AnalyticsModuleFilter,
      'all',
      'all',
      data.rawSnapshots,
    );
  }, [data, compareA]);

  const compareAvgB = useMemo(() => {
    if (!data || !compareB) return null;
    return getClassroomAverage5D(
      data.students as { id: string; snapshots: { user_id: string; submission_id: string; scores: import('@/integrations/supabase/types').Json }[] }[],
      data.rawSubmissions,
      data.assignments,
      compareB as AnalyticsModuleFilter,
      'all',
      'all',
      data.rawSnapshots,
    );
  }, [data, compareB]);

  const exportFilterSummary = useMemo(() => {
    const mod =
      selectedModule === 'all'
        ? allModulesLabel
        : selectedModule === 'unplaced'
          ? t('analytics.unplacedAssignments')
          : modules.find((m) => m.id === selectedModule)?.title ?? selectedModule;
    const asg =
      selectedAssignment === 'all'
        ? selectedModule === 'all'
          ? t('analytics.allAssignments')
          : t('analytics.allAssignmentsInScope')
        : assignments.find((a) => a.id === selectedAssignment)?.title ?? selectedAssignment;
    const stu =
      selectedStudent === 'all' ? t('analytics.allStudents') : allStudents.find((s) => s.id === selectedStudent)?.name ?? selectedStudent;
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
    [selectedModule, selectedAssignment, selectedStudent],
  );

  const sectionTitleResolver = useCallback(
    (syllabusSectionId: string | null) => {
      if (syllabusSectionId == null) return t('analytics.unplacedAssignments');
      return modules.find((m) => m.id === syllabusSectionId)?.title ?? '—';
    },
    [modules, t],
  );

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

  const compare5dEvidenceA = useMemo(() => {
    if (!data || !compareA) {
      return { evidenceText: '', sourceCount: 0 };
    }
    const allowed = getAllowedAssignmentIds(assignments, compareA, 'all');
    return build5dNarrativeEvidence({
      context: 'module_compare',
      allowedAssignmentIds: allowed,
      compareModuleId: compareA === 'unplaced' ? 'unplaced' : compareA,
      allStudents: data.students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
      })),
      assignmentRefs: data.assignments,
      sectionTitleResolver,
    });
  }, [data, compareA, assignments, sectionTitleResolver]);

  const compare5dEvidenceB = useMemo(() => {
    if (!data || !compareB) {
      return { evidenceText: '', sourceCount: 0 };
    }
    const allowed = getAllowedAssignmentIds(assignments, compareB, 'all');
    return build5dNarrativeEvidence({
      context: 'module_compare',
      allowedAssignmentIds: allowed,
      compareModuleId: compareB === 'unplaced' ? 'unplaced' : compareB,
      allStudents: data.students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        narrativeRows: (s as { narrativeRows?: Analytics5dNarrativeRow[] }).narrativeRows ?? [],
      })),
      assignmentRefs: data.assignments,
      sectionTitleResolver,
    });
  }, [data, compareB, assignments, sectionTitleResolver]);

  const studentList5dEvidenceById = useMemo(() => {
    if (!data) {
      return new Map<string, { evidenceText: string; sourceCount: number }>();
    }
    const allowed = getAllowedAssignmentIds(assignments, selectedModule, 'all');
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
        }),
      );
    }
    return m;
  }, [data, assignments, selectedModule, sectionTitleResolver]);

  const compareFilterSummary = useMemo(() => {
    if (!compareA || !compareB) return exportFilterSummary;
    const a =
      compareA === 'unplaced' ? t('analytics.unplacedAssignments') : modules.find((m) => m.id === compareA)?.title ?? compareA;
    const b =
      compareB === 'unplaced' ? t('analytics.unplacedAssignments') : modules.find((m) => m.id === compareB)?.title ?? compareB;
    return t('analytics.compareNarrativeScope', { a, b, filters: exportFilterSummary });
  }, [compareA, compareB, exportFilterSummary, t, modules]);

  const perStudentForExport = useMemo(() => {
    if (!data || effectiveAssignmentIds.length === 0) return [];
    const rows: { name: string; scores: FiveDScores }[] = [];
    for (const s of data.students) {
      const scores = scopedStudentLatestScores(s.snapshots, data.rawSubmissions, effectiveAssignmentIds);
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

  const studentsForCollapsible = useMemo(() => {
    if (selectedModule === 'all') {
      return students;
    }
    const scopeIds = getAllowedAssignmentIds(assignments, selectedModule, 'all');
    if (scopeIds.length === 0) {
      return students.map((s) => ({ ...s, latestScores: null, feedbackCount: 0, hardSkills: [] }));
    }
    const allow = new Set(scopeIds);
    return students.map((s) => {
      const fb = (data?.rawFeedback || []).filter(
        (f) => f.student_id === s.id && allow.has(f.assignment_id),
      );
      const latest = data
        ? scopedStudentLatestScores(s.snapshots, data.rawSubmissions, scopeIds)
        : null;
      const hardFiltered =
        s.hardSkills?.filter(
          (h) => h.assignment_id && allow.has(h.assignment_id as string),
        ) || [];
      return {
        ...s,
        feedbackCount: fb.length,
        latestScores: latest,
        hardSkills: hardFiltered,
      };
    });
  }, [students, data, selectedModule, assignments]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <NuanceInsightsTable
        classroomId={classroomId}
        students={allStudents}
        assignments={assignments}
        modules={modules}
        showUnplacedOption={showUnplaced}
        selectedModule={selectedModule}
        onModuleChange={onModuleChange}
        moduleFilterLabel={moduleFilterLabel}
        allModulesLabel={allModulesLabel}
        allAssignmentsInScopeLabel={allAssignmentsInScopeLabel}
        visibleAssignments={visibleAssignments}
        filterAssignmentIds={effectiveAssignmentIds}
        selectedStudent={selectedStudent}
        selectedAssignment={selectedAssignment}
        onStudentChange={onStudentChange}
        onAssignmentChange={onAssignmentChange}
      />

      <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
        <CardHeader className="pb-2 space-y-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className={`flex items-center gap-3 text-xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                  <Filter className="h-6 w-6 text-primary" />
                </div>
                {t('analytics.filtersTitle')}
              </CardTitle>
              <CardDescription className={`ms-12 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('analytics.filtersDescription')}
              </CardDescription>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 w-full sm:w-auto">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={handleExportCsv}
                  disabled={!data}
                >
                  <Download className="h-4 w-4 me-1.5" aria-hidden />
                  {t('analytics.exportCsv')}
                </Button>
                {onRegenerateComplete ? (
                  <RegenerateScoresButton
                    classroomId={classroomId}
                    onComplete={onRegenerateComplete}
                    compact
                  />
                ) : null}
              </div>
              {onRegenerateComplete && showRegenerateNote ? (
                <p className="flex items-start gap-1.5 max-w-[min(100%,18rem)] text-xs text-muted-foreground text-end self-end">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                  {t('analytics.regenerateClassWideNote')}
                </p>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <AnalyticsFilterControls
            allStudents={allStudents}
            assignments={visibleAssignments}
            modules={modules}
            showUnplacedOption={showUnplaced}
            selectedModule={selectedModule}
            onModuleChange={onModuleChange}
            moduleFilterLabel={moduleFilterLabel}
            allModulesLabel={allModulesLabel}
            selectedStudent={selectedStudent}
            selectedAssignment={selectedAssignment}
            onStudentChange={onStudentChange}
            onAssignmentChange={onAssignmentChange}
            allAssignmentsInScopeLabel={allAssignmentsInScopeLabel}
          />
        </CardContent>
      </Card>

      {effectiveAssignmentIds.length === 0 && selectedModule !== 'all' ? (
        <div className="text-center text-muted-foreground text-sm border border-dashed border-border rounded-xl py-8 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
          {t('analytics.emptyModuleOrScope')}
        </div>
      ) : null}

      {/* Key Metrics Grid */}
      <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="p-1.5 bg-primary/10 rounded-md">
                <Users className="h-3.5 w-3.5 text-primary" />
              </div>
              {t('analytics.totalStudents')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{studentCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="p-1.5 bg-primary/10 rounded-md">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
              </div>
              {t('analytics.assignments')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{displayAssignmentCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="p-1.5 bg-primary/10 rounded-md">
                <FileText className="h-3.5 w-3.5 text-primary" />
              </div>
              {t('analytics.totalSubmissions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">{displayTotalSubmissions}</div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-none shadow-md bg-card/80 backdrop-blur-sm overflow-hidden relative group hover:shadow-lg hover:-translate-y-1 transition-all duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm font-medium text-muted-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="p-1.5 bg-primary/10 rounded-md">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              </div>
              {t('analytics.completionRate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {displayCompletion}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm text-foreground"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <p className={isRTL ? 'text-right' : 'text-left'}>
          {t('analytics.coverageInScope', { covered: coveredStudents, enrolled: studentCount })}
        </p>
      </div>

      {canCompareSections ? (
        <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className={`flex items-center gap-3 text-lg font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <GitCompare className="h-5 w-5 text-primary" />
              </div>
              {t('analytics.compareSections')}
            </CardTitle>
            <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
              {t('analytics.compareHint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
              <div className="space-y-2 sm:min-w-[200px]">
                <span className={`text-sm font-semibold text-muted-foreground block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('analytics.compareModuleA')}
                </span>
                <Select
                  value={compareA || '_none_'}
                  onValueChange={(v) => setCompareA(v === '_none_' ? '' : v)}
                >
                  <SelectTrigger className="h-11 rounded-lg" dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectValue placeholder={t('analytics.compareSelectSection')}>
                      {compareA ? labelForCompareModule(compareA) : t('analytics.compareSelectSection')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">{t('analytics.compareSelectSection')}</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.title}
                      </SelectItem>
                    ))}
                    {showUnplaced ? (
                      <SelectItem value="unplaced">{t('analytics.unplacedAssignments')}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:min-w-[200px]">
                <span className={`text-sm font-semibold text-muted-foreground block ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('analytics.compareModuleB')}
                </span>
                <Select
                  value={compareB || '_none_'}
                  onValueChange={(v) => setCompareB(v === '_none_' ? '' : v)}
                >
                  <SelectTrigger className="h-11 rounded-lg" dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectValue placeholder={t('analytics.compareSelectSection')}>
                      {compareB ? labelForCompareModule(compareB) : t('analytics.compareSelectSection')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_">{t('analytics.compareSelectSection')}</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={`b-${m.id}`} value={m.id}>
                        {m.title}
                      </SelectItem>
                    ))}
                    {showUnplaced ? (
                      <SelectItem value="unplaced">{t('analytics.unplacedAssignments')}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {compareA && compareB && compareA === compareB ? (
              <p className="text-sm text-amber-700 dark:text-amber-500">{t('analytics.compareSameSection')}</p>
            ) : null}

            {compareA && compareB && compareA !== compareB && (!compareAvgA || !compareAvgB) ? (
              <p className="text-sm text-muted-foreground">{t('classroomAnalytics.noStudentDataInScope')}</p>
            ) : null}

            {compareAvgA && compareAvgB && compareA && compareB && compareA !== compareB ? (
              <>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[28%]">{t('analytics.compareDimension')}</TableHead>
                        <TableHead className="text-center">
                          {compareA === 'unplaced' ? t('analytics.unplacedAssignments') : modules.find((m) => m.id === compareA)?.title ?? 'A'}
                        </TableHead>
                        <TableHead className="text-center">
                          {compareB === 'unplaced' ? t('analytics.unplacedAssignments') : modules.find((m) => m.id === compareB)?.title ?? 'B'}
                        </TableHead>
                        <TableHead className="text-center w-[20%]">{t('analytics.compareDelta')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(['vision', 'values', 'thinking', 'connection', 'action'] as const).map((dim) => {
                        const a = compareAvgA[dim];
                        const b = compareAvgB[dim];
                        const d = b - a;
                        return (
                          <TableRow key={dim}>
                            <TableCell className="font-medium">
                              {t(`submissionDetail.dimensions.${dim}`)}
                            </TableCell>
                            <TableCell className="text-center tabular-nums">{a.toFixed(2)}</TableCell>
                            <TableCell className="text-center tabular-nums">{b.toFixed(2)}</TableCell>
                            <TableCell className="text-center tabular-nums text-muted-foreground">
                              {d >= 0 ? '+' : ''}
                              {d.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/60 p-2 bg-muted/10">
                    {compareAvgA && compareAvgB && compareA && compareB && compareA !== compareB ? (
                      <CompareSide5dNarrativeBlock
                        classroomId={classroomId}
                        sideScores={compareAvgA}
                        filterSummary={compareFilterSummary}
                        language={analyticsLanguage}
                        compareLabelA={labelForCompareModule(compareA)}
                        compareLabelB={labelForCompareModule(compareB)}
                        peerScores={compareAvgB}
                        isRTL={isRTL}
                        enabled
                        narrativeId={`5d-compare-a-${compareA}-${compareB}`}
                        evidenceText={compare5dEvidenceA.evidenceText}
                        evidenceSourceCount={compare5dEvidenceA.sourceCount}
                      />
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-border/60 p-2 bg-muted/10">
                    {compareAvgA && compareAvgB && compareA && compareB && compareA !== compareB ? (
                      <CompareSide5dNarrativeBlock
                        classroomId={classroomId}
                        sideScores={compareAvgB}
                        filterSummary={compareFilterSummary}
                        language={analyticsLanguage}
                        compareLabelA={labelForCompareModule(compareB)}
                        compareLabelB={labelForCompareModule(compareA)}
                        peerScores={compareAvgA}
                        isRTL={isRTL}
                        enabled
                        narrativeId={`5d-compare-b-${compareA}-${compareB}`}
                        evidenceText={compare5dEvidenceB.evidenceText}
                        evidenceSourceCount={compare5dEvidenceB.sourceCount}
                      />
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {classAverage && effectiveAssignmentIds.length > 0 && (
            <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
              <CardHeader className="border-b border-border pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={`text-xl font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className="p-2 bg-primary/10 rounded-xl">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      {selectedStudent === 'all' ? t('analytics.classAverage') : allStudents.find((s) => s.id === selectedStudent)?.name}
                    </CardTitle>
                    <CardDescription className={`mt-1 ms-11 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {chartSubtext}
                    </CardDescription>
                  </div>
                  {selectedStudent === 'all' && (
                    <Badge variant="secondary" className="rounded-full px-4 py-1 bg-primary/10 text-primary">
                      {t('classroomAnalytics.classOverview')}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {classAverage ? (
                  <MainAnalytics5dNarrativeBlock
                    classroomId={classroomId}
                    classAverage={classAverage}
                    filterSummary={exportFilterSummary}
                    language={analyticsLanguage}
                    selectedStudent={selectedStudent}
                    studentName={allStudents.find((s) => s.id === selectedStudent)?.name}
                    isRTL={isRTL}
                    enabled
                    narrativeId={main5dNarrativeId}
                    evidenceText={main5dNarrativeEvidence.evidenceText}
                    evidenceSourceCount={main5dNarrativeEvidence.sourceCount}
                  />
                ) : null}
              </CardContent>
            </Card>
          )}

          {showTopCra && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
              <HardSkillsAssessmentTable
                studentId={selectedStudent === 'all' ? undefined : selectedStudent}
                assignmentId={craForModuleWithAllAssignments ? 'all' : selectedAssignment}
                classroomId={classroomId}
                classroomAssignmentIdFilter={craForModuleWithAllAssignments ? moduleScopeIds : null}
                title={t('cra.title')}
                description={
                  selectedStudent !== 'all'
                    ? t('classroomAnalytics.hardSkillsFor', { student: allStudents.find((s) => s.id === selectedStudent)?.name })
                    : t('classroomAnalytics.hardSkillsAssignmentFor', { assignment: assignments.find((a) => a.id === selectedAssignment)?.title })
                }
              />
            </div>
          )}

          {selectedStudent === 'all' && selectedAssignment === 'all' && (
            <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
              <CardHeader className="border-b border-border pb-6">
                <CardTitle className={`text-xl font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  {t('classroomAnalytics.studentPerformanceOverview')}
                </CardTitle>
                <CardDescription className={`ms-11 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomAnalytics.detailedBreakdown')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {studentsForCollapsible.filter((s) => s.latestScores).length === 0 ? (
                  <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border" dir={isRTL ? 'rtl' : 'ltr'}>
                    <p className={`text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{t('classroomAnalytics.noStudentDataInScope')}</p>
                  </div>
                ) : (
                  studentsForCollapsible
                    .filter((s) => s.latestScores)
                    .map((student) => (
                      <Collapsible
                        key={student.id}
                        open={student5dNarrativeOpen.has(student.id)}
                        onOpenChange={(open) => {
                          setStudent5dNarrativeOpen((prev) => {
                            const next = new Set(prev);
                            if (open) next.add(student.id);
                            else next.delete(student.id);
                            return next;
                          });
                        }}
                        className="border border-border rounded-lg overflow-hidden bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            variant="ghost"
                            className="w-full justify-between p-5 h-auto hover:bg-transparent"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {student.fullName.charAt(0)}
                              </div>
                              <span className={`font-semibold text-foreground text-base ${isRTL ? 'text-right' : 'text-left'}`}>
                                {student.fullName}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="rounded-full bg-card">
                                {student.feedbackCount} {t('classroomAnalytics.submissions')}
                              </Badge>
                              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                            </div>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-5 pb-5 space-y-6 bg-card/50 border-t border-border">
                          <div className="pt-4">
                            <h4 className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                              <Sparkles className="h-3 w-3" />
                              {t('classroomAnalytics.average5DProfile')}
                            </h4>
                            <StudentList5dNarrativeBlock
                              classroomId={classroomId}
                              studentId={student.id}
                              studentName={student.fullName}
                              scores={student.latestScores! as FiveDScores}
                              filterSummary={exportFilterSummary}
                              language={analyticsLanguage}
                              isOpen={student5dNarrativeOpen.has(student.id)}
                              isRTL={isRTL}
                              enabled
                              evidenceText={studentList5dEvidenceById.get(student.id)?.evidenceText}
                              evidenceSourceCount={studentList5dEvidenceById.get(student.id)?.sourceCount}
                            />
                          </div>
                          <div className="border-t border-border pt-6">
                            <HardSkillsAssessmentTable
                              studentId={student.id}
                              assignmentId="all"
                              classroomId={classroomId}
                              classroomAssignmentIdFilter={
                                selectedModule === 'all' ? null : moduleScopeIds
                              }
                              initialData={student.hardSkills as any}
                              title={t('cra.title')}
                              description={t('classroomAnalytics.allHardSkills')}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                )}
              </CardContent>
            </Card>
          )}

          {showAllStudentsCraList && (
            <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
              <CardHeader className="border-b border-border pb-6">
                <CardTitle className={`text-xl font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  {t('cra.title')}
                </CardTitle>
                <CardDescription className={`ms-11 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomAnalytics.hardSkillsAllStudents', { assignment: assignments.find((a) => a.id === selectedAssignment)?.title })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {allStudents.map((student) => (
                  <Collapsible key={student.id} className="border border-border rounded-lg overflow-hidden bg-muted/20">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-5 h-auto hover:bg-muted/40">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {student.name.charAt(0)}
                          </div>
                          <span className={`font-semibold text-foreground text-base ${isRTL ? 'text-right' : 'text-left'}`}>
                            {student.name}
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-5 pb-5 bg-card/50 border-t border-border pt-4">
                      <HardSkillsAssessmentTable
                        studentId={student.id}
                        assignmentId={selectedAssignment}
                        classroomId={classroomId}
                        initialData={(data?.rawHardSkills?.filter(h => h.student_id === student.id && h.assignment_id === selectedAssignment) || []) as any}
                        title=""
                        description=""
                      />
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden sticky top-6" dir={isRTL ? 'rtl' : 'ltr'}>
            <CardHeader className="bg-transparent border-b border-border pb-6">
              <CardTitle className={`text-lg font-bold text-foreground flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                {t('analytics.performanceSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <p className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('analytics.activeStudents')}
                    </p>
                    <p className={`text-2xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                      {displayActiveStudents} <span className="text-sm text-muted-foreground font-normal">/ {studentCount}</span>
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <p className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('analytics.avgSubmissions')}
                    </p>
                    <p className={`text-2xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                      {displayAvgSubmissions}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                  <div>
                    <p className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('analytics.engagementRate')}
                    </p>
                    <p className={`text-2xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
                      {displayEngagement}%
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {classAverage && studentsForCollapsible.filter((s) => s.latestScores).length > 0 && (
                <div className="pt-6 border-t border-border">
                  <h4 className={`text-sm font-bold text-foreground mb-4 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t('analytics.average5D')}
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(classAverage).map(([dimension, score]) => {
                      const numeric = Number(score);
                      return (
                        <div key={dimension} className="flex items-center justify-between">
                          <span className={`text-sm font-medium text-muted-foreground capitalize ${isRTL ? 'text-right' : 'text-left'}`}>
                            {t(`submissionDetail.dimensions.${dimension}`)}
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${(numeric / 10) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-foreground w-8 text-right">
                              {numeric.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
