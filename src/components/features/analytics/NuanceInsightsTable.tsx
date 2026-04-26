import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Brain, ChevronDown, Loader2, ArrowUpDown, RefreshCw, Info } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNuanceInsights } from '@/hooks/queries';
import type { NuanceMetric, NuanceRecommendation } from '@/hooks/queries/useNuanceQueries';
import { StudentInsightCard } from './StudentInsightCard';
import { NuanceUnderstandingCuePanel } from './NuanceUnderstandingCuePanel';
import { AnalyticsFilterControls } from './AnalyticsFilterControls';
import type { AnalyticsAssignmentRef, AnalyticsModuleRef } from '@/lib/analyticsScope';
import type { AnalyticsModuleFilter } from '@/lib/analyticsScope';

interface NuanceInsightsTableProps {
  classroomId: string;
  students: { id: string; name: string }[];
  /** All classroom assignments (for labels) */
  assignments: AnalyticsAssignmentRef[];
  modules: AnalyticsModuleRef[];
  showUnplacedOption: boolean;
  selectedModule: AnalyticsModuleFilter;
  onModuleChange: (value: AnalyticsModuleFilter) => void;
  moduleFilterLabel: string;
  allModulesLabel: string;
  allAssignmentsInScopeLabel: string;
  visibleAssignments: AnalyticsAssignmentRef[];
  filterAssignmentIds: string[];
  selectedStudent: string;
  selectedAssignment: string;
  onStudentChange: (value: string) => void;
  onAssignmentChange: (value: string) => void;
}

type SortField = 'name' | 'latency' | 'idle' | 'completion' | 'sessions' | 'cues';
type SortDir = 'asc' | 'desc';

function formatLatency(ms: number | null): string {
  if (ms === null) return '—';
  if (ms > 60000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}

interface AggregatedRow {
  key: string;
  label: string;
  studentId: string;
  assignmentId?: string;
  avgLatency: number | null;
  idleRatio: number;
  completionRate: number;
  sessionCount: number;
  understandingCueCount: number;
  recommendation?: NuanceRecommendation;
}

export function NuanceInsightsTable({
  classroomId,
  students,
  assignments,
  modules,
  showUnplacedOption,
  selectedModule,
  onModuleChange,
  moduleFilterLabel,
  allModulesLabel,
  allAssignmentsInScopeLabel,
  visibleAssignments,
  filterAssignmentIds,
  selectedStudent,
  selectedAssignment,
  onStudentChange,
  onAssignmentChange,
}: NuanceInsightsTableProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const dir = isRTL ? 'rtl' : 'ltr';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [howNuanceOpen, setHowNuanceOpen] = useState(false);

  const { data, isLoading, isFetching, refetch } = useNuanceInsights(classroomId);

  const classBaseline = data?.baselines?.class;
  const classReferenceLine = useMemo(() => {
    if (!classBaseline || !classBaseline.assignment_count || classBaseline.assignment_count <= 0) {
      return null;
    }
    return t('nuance.classReference', {
      latency: formatLatency(
        classBaseline.avg_latency > 0 ? classBaseline.avg_latency : null,
      ),
      idle: formatPercent(classBaseline.avg_idle_ratio),
      completion: formatPercent(classBaseline.avg_completion_rate),
      n: classBaseline.assignment_count,
    });
  }, [classBaseline, t]);

  const metrics = data?.metrics || [];
  const recommendations = data?.recommendations || [];

  const filteredMetrics = useMemo(() => {
    if (filterAssignmentIds.length === 0) return [];
    const set = new Set(filterAssignmentIds);
    return metrics.filter((m) => set.has(m.assignment_id));
  }, [metrics, filterAssignmentIds]);

  const recMap = useMemo(() => {
    const map = new Map<string, NuanceRecommendation>();
    for (const r of recommendations) {
      map.set(r.student_id, r);
    }
    return map;
  }, [recommendations]);

  const studentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) map.set(s.id, s.name);
    return map;
  }, [students]);

  const assignmentTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments) map.set(a.id, a.title);
    return map;
  }, [assignments]);

  const scopingAssignmentCount = filterAssignmentIds.length;

  const rows: AggregatedRow[] = useMemo(() => {
    if (filteredMetrics.length === 0) return [];
    const sameStudent = (a: string, b: string) => String(a) === String(b);
    const sameAssignment = (a: string, b: string) => String(a) === String(b);

    // Specific student → one row per assignment
    if (selectedStudent !== 'all') {
      const studentMetrics = filteredMetrics.filter((m) => sameStudent(m.student_id, selectedStudent));
      const filtered =
        selectedAssignment !== 'all'
          ? studentMetrics.filter((m) => sameAssignment(m.assignment_id, selectedAssignment))
          : studentMetrics;

      return filtered.map((m) => ({
        key: `${m.student_id}:${m.assignment_id}`,
        label: assignmentTitleMap.get(m.assignment_id) || 'Unknown',
        studentId: m.student_id,
        assignmentId: m.assignment_id,
        avgLatency: m.avg_response_latency_ms,
        idleRatio: m.idle_ratio,
        completionRate: m.completion_status === 'completed' ? 1 : 0,
        sessionCount: m.session_count,
        understandingCueCount: m.understanding_cue_count ?? 0,
        recommendation: recMap.get(m.student_id),
      }));
    }

    // All students → aggregate per student (optionally filtered by assignment)
    const filtered =
      selectedAssignment !== 'all'
        ? filteredMetrics.filter((m) => sameAssignment(m.assignment_id, selectedAssignment))
        : filteredMetrics;

    const grouped = new Map<string, NuanceMetric[]>();
    for (const m of filtered) {
      if (!grouped.has(m.student_id)) grouped.set(m.student_id, []);
      grouped.get(m.student_id)!.push(m);
    }

    const totalAssignments = selectedAssignment !== 'all' ? 1 : Math.max(scopingAssignmentCount, 1);

    const result: AggregatedRow[] = [];
    for (const [sid, mets] of grouped) {
      const latencies = mets
        .map((m) => m.avg_response_latency_ms)
        .filter((v): v is number => v !== null);

      const completed = mets.filter((m) => m.completion_status === 'completed').length;
      const denominator = Math.max(totalAssignments, mets.length);

      result.push({
        key: sid,
        label: studentNameMap.get(sid) || 'Unknown',
        studentId: sid,
        avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
        idleRatio: mets.reduce((s, m) => s + m.idle_ratio, 0) / mets.length,
        completionRate: denominator > 0 ? completed / denominator : 0,
        sessionCount: Math.round(mets.reduce((s, m) => s + m.session_count, 0) / mets.length),
        understandingCueCount: Math.round(
          mets.reduce((s, m) => s + (m.understanding_cue_count ?? 0), 0) / mets.length,
        ),
        recommendation: recMap.get(sid),
      });
    }

    return result;
  }, [
    filteredMetrics,
    selectedStudent,
    selectedAssignment,
    scopingAssignmentCount,
    recMap,
    studentNameMap,
    assignmentTitleMap,
  ]);

  // Sorting
  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.label.localeCompare(b.label);
          break;
        case 'latency':
          cmp = (a.avgLatency ?? 0) - (b.avgLatency ?? 0);
          break;
        case 'idle':
          cmp = a.idleRatio - b.idleRatio;
          break;
        case 'completion':
          cmp = a.completionRate - b.completionRate;
          break;
        case 'sessions':
          cmp = a.sessionCount - b.sessionCount;
          break;
        case 'cues':
          cmp = a.understandingCueCount - b.understandingCueCount;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, sortField, sortDir]);

  const selectedStudentHasNuanceOutsideFilter = useMemo(() => {
    if (selectedStudent === 'all' || filterAssignmentIds.length === 0) return false;
    const scope = new Set(filterAssignmentIds);
    return metrics.some(
      (m) => String(m.student_id) === String(selectedStudent) && !scope.has(m.assignment_id),
    );
  }, [metrics, filterAssignmentIds, selectedStudent]);

  const emptyNuanceMessage = useMemo(() => {
    if (isLoading || sortedRows.length > 0) return null;
    const same = (a: string, b: string) => String(a) === String(b);
    if (metrics.length === 0) return t('nuance.noData');
    if (filterAssignmentIds.length === 0) return t('nuance.emptyNoAssignmentsInFilter');
    if (filteredMetrics.length === 0) return t('nuance.emptyNoDataInFilter');
    if (selectedStudent !== 'all' && selectedAssignment !== 'all') {
      const ok = filteredMetrics.some(
        (m) => same(m.student_id, selectedStudent) && same(m.assignment_id, selectedAssignment),
      );
      if (!ok) return t('nuance.emptyNoDataForPairInFilter');
    }
    if (selectedStudent !== 'all') {
      const ok = filteredMetrics.some((m) => same(m.student_id, selectedStudent));
      if (!ok) return t('nuance.emptyNoDataForStudentInFilter');
    }
    if (selectedAssignment !== 'all') {
      const ok = filteredMetrics.some((m) => same(m.assignment_id, selectedAssignment));
      if (!ok) return t('nuance.emptyNoDataForAssignmentInFilter');
    }
    return t('nuance.noData');
  }, [
    isLoading,
    sortedRows.length,
    metrics.length,
    filterAssignmentIds.length,
    filteredMetrics,
    selectedStudent,
    selectedAssignment,
    t,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortableHeader = ({ 
    field, 
    children, 
    align = 'center',
    className = '',
    tooltip,
  }: { 
    field: SortField; 
    children: React.ReactNode; 
    align?: 'start' | 'center';
    className?: string;
    tooltip?: string;
  }) => (
    <TableHead
      className={`overflow-hidden align-middle px-2 py-2 ${
        align === 'center'
          ? 'h-auto min-h-12 whitespace-normal text-center'
          : 'text-left'
      } ${className}`}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={`min-h-8 w-full font-semibold text-xs uppercase tracking-wider px-1 ${
                align === 'center'
                  ? 'flex h-auto flex-col items-center justify-center gap-0.5 py-1.5'
                  : 'flex h-8 max-w-full flex-row items-center justify-start gap-1'
              }`}
              onClick={() => handleSort(field)}
            >
              <span
                className={
                  align === 'center'
                    ? 'line-clamp-2 w-full text-center leading-tight'
                    : 'truncate text-start'
                }
              >
                {children}
              </span>
              <ArrowUpDown className="h-3 w-3 shrink-0 opacity-60" />
            </Button>
          }
        />
        {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
      </Tooltip>
    </TableHead>
  );

  return (
    <Card
      className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden"
      dir={dir}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle
              className={`flex items-center gap-3 text-xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              {t('nuance.title', 'Student Behavioral Insights')}
            </CardTitle>
            <CardDescription className={`ms-12 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('nuance.description', 'Nuance system recommendations based on activity patterns')}
            </CardDescription>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
              }
            />
            <TooltipContent>{t('nuance.refresh', 'Refresh insights')}</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <AnalyticsFilterControls
          allStudents={students}
          assignments={visibleAssignments}
          modules={modules}
          showUnplacedOption={showUnplacedOption}
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
        <div className={`space-y-2 text-xs text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          <p>{t('nuance.baselinesClassWide')}</p>
          <p>{t('nuance.insightScope')}</p>
          {classReferenceLine && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <p className="text-foreground/90 cursor-help decoration-dotted underline-offset-2 underline">
                    {classReferenceLine}
                  </p>
                }
              />
              <TooltipContent className="max-w-sm">{t('nuance.classReferenceScope')}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <Collapsible open={howNuanceOpen} onOpenChange={setHowNuanceOpen} className="rounded-xl border border-border bg-muted/20">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary shrink-0" />
                {t('nuance.howNuanceTitle')}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${howNuanceOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-border px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
            {t('nuance.howNuanceBody')}
          </CollapsibleContent>
        </Collapsible>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
            <Brain className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
              {emptyNuanceMessage ?? t('nuance.noData')}
            </p>
            {selectedStudent !== 'all' && selectedStudentHasNuanceOutsideFilter && (
              <p className="text-muted-foreground text-sm max-w-lg mx-auto mt-4 leading-relaxed border-t border-border/60 pt-4">
                {t('nuance.hintStudentNuanceInOtherScope')}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-xl border border-border overflow-hidden [&_[data-slot=table-container]]:overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[36px]" />
                  <SortableHeader field="name" align="start" tooltip={t('nuance.tooltips.student')}>
                    {selectedStudent !== 'all'
                      ? t('nuance.columns.activity', 'Activity')
                      : t('nuance.columns.student', 'Student')}
                  </SortableHeader>
                  <SortableHeader field="latency" tooltip={t('nuance.tooltips.responseTime')}>
                    {t('nuance.columns.responseTime', 'Avg Response')}
                  </SortableHeader>
                  <SortableHeader field="idle" tooltip={t('nuance.tooltips.idleRatio')}>
                    {t('nuance.columns.idleRatio', 'Idle Ratio')}
                  </SortableHeader>
                  <SortableHeader field="completion" tooltip={t('nuance.tooltips.completion')}>
                    {t('nuance.columns.completion', 'Completion')}
                  </SortableHeader>
                  <SortableHeader field="sessions" tooltip={t('nuance.tooltips.sessions')}>
                    {t('nuance.columns.sessions', 'Sessions')}
                  </SortableHeader>
                  <SortableHeader
                    field="cues"
                    tooltip={t('nuance.tooltips.cuesInChatColumn', t('nuance.tooltips.cuesInChat'))}
                  >
                    {t('nuance.columns.cuesInChat', 'Cues in chat')}
                  </SortableHeader>
                  <TableHead className="w-[100px] min-w-[5.5rem] px-1">
                    <div className="flex justify-center ltr:-translate-x-0.5">
                      <Tooltip>
                        <TooltipTrigger className="text-xs font-semibold uppercase tracking-wider cursor-default">
                          {t('nuance.columns.status', 'Status')}
                        </TooltipTrigger>
                        <TooltipContent>{t('nuance.tooltips.status')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row) => (
                  <React.Fragment key={row.key}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() =>
                        setExpandedRow(expandedRow === row.key ? null : row.key)
                      }
                    >
                      <TableCell className="w-[36px] px-2">
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                            expandedRow === row.key ? 'rotate-180' : ''
                          }`}
                        />
                      </TableCell>
                      <TableCell className="font-medium truncate px-2 py-3">{row.label}</TableCell>
                      <TableCell className="px-2 py-3 text-center tabular-nums">
                        {formatLatency(row.avgLatency)}
                      </TableCell>
                      <TableCell className="px-2 py-3 text-center tabular-nums">
                        {formatPercent(row.idleRatio)}
                      </TableCell>
                      <TableCell className="px-2 py-3 text-center tabular-nums">
                        {formatPercent(row.completionRate)}
                      </TableCell>
                      <TableCell className="px-2 py-3 text-center tabular-nums">{row.sessionCount}</TableCell>
                      <TableCell className="px-2 py-3 text-center tabular-nums text-xs">
                        {row.understandingCueCount}
                      </TableCell>
                      <TableCell className="px-1 py-2 text-center">
                        <div
                          className="flex items-center justify-center gap-1.5 flex-wrap"
                          title={
                            row.recommendation
                              ? t(`nuance.types.${row.recommendation.recommendation_type}`)
                              : t('nuance.statusRow.typical')
                          }
                        >
                          {row.recommendation ? (
                            <>
                              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
                              <span className="text-[10px] font-medium leading-tight text-amber-700 dark:text-amber-400 max-w-[4.5rem]">
                                {t('nuance.statusRow.insight')}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70 shrink-0" />
                              <span className="text-[10px] font-medium leading-tight text-muted-foreground max-w-[4.5rem]">
                                {t('nuance.statusRow.typical')}
                              </span>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRow === row.key && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={8} className="p-0">
                          <div className="px-4 py-3 bg-muted/20 border-t border-border w-0 min-w-full overflow-hidden space-y-1">
                            {row.recommendation ? (
                              <StudentInsightCard recommendation={row.recommendation} />
                            ) : (
                              <div className="text-sm text-muted-foreground text-center py-4">
                                {t('nuance.noRecommendation')}
                              </div>
                            )}
                            <NuanceUnderstandingCuePanel
                              studentId={row.studentId}
                              assignmentScopeIds={
                                row.assignmentId
                                  ? [row.assignmentId]
                                  : filterAssignmentIds
                              }
                              isExpanded
                              assignmentTitleMap={assignmentTitleMap}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
            </div>
            {filterAssignmentIds.length > 0 && selectedStudent === 'all' && (
              <p
                className={`text-xs text-muted-foreground max-w-3xl leading-relaxed ${
                  isRTL ? 'text-right' : 'text-left'
                }`}
              >
                {t('nuance.notAllEnrolledInTable')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
