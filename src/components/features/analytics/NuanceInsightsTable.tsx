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
import { Brain, ChevronDown, Loader2, ArrowUpDown, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useNuanceInsights } from '@/hooks/queries';
import type { NuanceMetric, NuanceRecommendation } from '@/hooks/queries/useNuanceQueries';
import { StudentInsightCard } from './StudentInsightCard';
import { AnalyticsFilterControls } from './AnalyticsFilterControls';

interface NuanceInsightsTableProps {
  classroomId: string;
  students: { id: string; name: string }[];
  assignments: { id: string; title: string }[];
  selectedStudent: string;
  selectedAssignment: string;
  onStudentChange: (value: string) => void;
  onAssignmentChange: (value: string) => void;
}

type SortField = 'name' | 'latency' | 'idle' | 'completion' | 'sessions';
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
  recommendation?: NuanceRecommendation;
}

export function NuanceInsightsTable({
  classroomId,
  students,
  assignments,
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

  const { data, isLoading, isFetching, refetch } = useNuanceInsights(classroomId);

  const metrics = data?.metrics || [];
  const recommendations = data?.recommendations || [];

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

  const rows: AggregatedRow[] = useMemo(() => {
    if (metrics.length === 0) return [];

    // Specific student → one row per assignment
    if (selectedStudent !== 'all') {
      const studentMetrics = metrics.filter((m) => m.student_id === selectedStudent);
      const filtered =
        selectedAssignment !== 'all'
          ? studentMetrics.filter((m) => m.assignment_id === selectedAssignment)
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
        recommendation: recMap.get(m.student_id),
      }));
    }

    // All students → aggregate per student (optionally filtered by assignment)
    const filtered =
      selectedAssignment !== 'all'
        ? metrics.filter((m) => m.assignment_id === selectedAssignment)
        : metrics;

    const grouped = new Map<string, NuanceMetric[]>();
    for (const m of filtered) {
      if (!grouped.has(m.student_id)) grouped.set(m.student_id, []);
      grouped.get(m.student_id)!.push(m);
    }

    const totalAssignments = selectedAssignment !== 'all' ? 1 : assignments.length;

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
        recommendation: recMap.get(sid),
      });
    }

    return result;
  }, [metrics, selectedStudent, selectedAssignment, recMap, studentNameMap, assignmentTitleMap]);

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
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, sortField, sortDir]);

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
          assignments={assignments}
          selectedStudent={selectedStudent}
          selectedAssignment={selectedAssignment}
          onStudentChange={onStudentChange}
          onAssignmentChange={onAssignmentChange}
        />

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
            <Brain className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {t('nuance.noData', 'No behavioral data available yet. Data will appear as students complete activities.')}
            </p>
          </div>
        ) : (
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
                  <TableHead className="w-[60px] px-1">
                    <div className="flex justify-center ltr:-translate-x-1 rtl:translate-x-1">
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
                      <TableCell className="px-2 py-3 text-center">
                        <div className="flex justify-center ltr:-translate-x-1 rtl:translate-x-1">
                          {row.recommendation ? (
                            <span className="flex h-3 w-3 rounded-full bg-amber-500" title={t(`nuance.types.${row.recommendation.recommendation_type}`)} />
                          ) : (
                            <span className="flex h-3 w-3 rounded-full bg-emerald-500/60" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRow === row.key && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="p-0">
                          <div className="px-4 py-3 bg-muted/20 border-t border-border w-0 min-w-full overflow-hidden">
                            {row.recommendation ? (
                              <StudentInsightCard recommendation={row.recommendation} />
                            ) : (
                              <div className="text-sm text-muted-foreground text-center py-4">
                                {t('nuance.noRecommendation', 'No recommendations — activity patterns are within normal range.')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
