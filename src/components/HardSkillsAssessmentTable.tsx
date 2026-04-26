import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, FolderOpen, Info, Loader2, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { HardSkillAssessmentWithStudent } from '@/types/hard-skills';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CRA_SELECT = `
  *,
  assignments (
    id,
    title,
    syllabus_section_id,
    syllabus_sections ( title, order_index )
  )
`.replace(/\s+/g, ' ');

const CRA_MOBILE_DIALOG_CONTENT_ID = 'cra-mobile-detail-panel';

type LayoutMode = 'flat' | 'grouped';

type EnrichedAssessment = HardSkillAssessmentWithStudent & {
  _assignmentTitle: string;
  _sectionId: string | null;
  _sectionTitle: string;
  _sectionOrder: number;
};

interface HardSkillsAssessmentTableProps {
  submissionId?: string;
  assignmentId?: string;
  classroomId?: string;
  studentId?: string;
  /** When set with student + all assignments, limit to these assignment ids (e.g. syllabus module scope). */
  classroomAssignmentIdFilter?: string[] | null;
  title?: string;
  description?: string;
  initialData?: HardSkillAssessmentWithStudent[];
  /** `flat` = original single list (e.g. submission detail). `grouped` = assignment / optional module & domain. */
  layout?: LayoutMode;
  /** Initial value for "Group by module" when `layout` is `grouped` (user can toggle). */
  defaultGroupByModule?: boolean;
  /** Initial value for "Group by domain" when `layout` is `grouped`. */
  defaultGroupByDomain?: boolean;
}

function enrichAssessments(
  rows: HardSkillAssessmentWithStudent[],
  t: TFunction,
): EnrichedAssessment[] {
  return rows.map((a) => {
    const aj = a.assignments;
    const sec = aj?.syllabus_sections;
    const title = aj?.title?.trim() || t('cra.unknownAssignment');
    const sectionId = aj?.syllabus_section_id ?? null;
    const sectionTitle = sec?.title?.trim() || (sectionId ? '—' : t('cra.unplacedSection'));
    const order = typeof sec?.order_index === 'number' ? sec.order_index! : 9999;
    return {
      ...a,
      _assignmentTitle: title,
      _sectionId: sectionId,
      _sectionTitle: sectionTitle,
      _sectionOrder: order,
    };
  });
}

function scopeSummaryText(rows: EnrichedAssessment[], t: TFunction) {
  if (rows.length === 0) return '';
  const assignmentIds = new Set(rows.map((r) => r.assignment_id));
  const students = new Set(rows.map((r) => r.student_id));
  const byDomain = new Map<string, { sum: number; c: number }>();
  for (const r of rows) {
    const d = r.domain;
    const cur = byDomain.get(d) || { sum: 0, c: 0 };
    cur.sum += r.current_level_percent;
    cur.c += 1;
    byDomain.set(d, cur);
  }
  const avgs = [...byDomain.entries()].map(([d, { sum, c }]) => ({ d, v: sum / c }));
  avgs.sort((a, b) => b.v - a.v);
  const top = avgs[0];
  const bottom = avgs[avgs.length - 1];
  return t('cra.scopeSummary', {
    skills: rows.length,
    assignments: assignmentIds.size,
    students: students.size,
    topDomain: top?.d ?? '—',
    bottomDomain: bottom?.d ?? '—',
  });
}

/** Simple bar only (avoids Base UI Progress extra nodes that can show a stray end control in some UAs). */
function CraPercentBar({ value, barClassName }: { value: number; barClassName: string }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div
      className="relative h-2 w-full overflow-hidden rounded-full border border-border/60 bg-muted/80 shadow-inner"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
    >
      <div
        className={cn('h-full min-w-0 rounded-s-full transition-[width] duration-300', barClassName)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

function sortEnrichedRows(rows: EnrichedAssessment[]) {
  return [...rows].sort((a, b) => {
    if (a._sectionOrder !== b._sectionOrder) return a._sectionOrder - b._sectionOrder;
    const at = a._assignmentTitle.localeCompare(b._assignmentTitle);
    if (at !== 0) return at;
    const d = a.domain.localeCompare(b.domain);
    if (d !== 0) return d;
    return a.skill_component.localeCompare(b.skill_component);
  });
}

function CraDetailBody({ assessment, t }: { assessment: EnrichedAssessment; t: TFunction }) {
  return (
    <div className="rounded-md bg-muted/30 p-3 space-y-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{t('cra.table.detailsProficiencyPrefix')}</p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{assessment.proficiency_description}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{t('cra.table.detailsNextStepsPrefix')}</p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{assessment.actionable_challenge}</p>
      </div>
    </div>
  );
}

type CraRowOpts = {
  showStudentCol: boolean;
  showModuleCol: boolean;
  showAssignmentCol: boolean;
  groupByDomain: boolean;
  /** On narrow viewports, details open in a dialog instead of an extra table row. */
  isMobile: boolean;
  submissionId?: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  getPerformanceColor: (n: number) => string;
  getPerformanceBarClass: (n: number) => string;
  getPerformanceBadge: (n: number) => { label: string; variant: 'default' | 'secondary' | 'outline' };
  t: TFunction;
};

function craColCount(opts: Pick<CraRowOpts, 'showStudentCol' | 'showModuleCol' | 'showAssignmentCol'>) {
  return (
    (opts.showStudentCol ? 1 : 0) +
    (opts.showModuleCol ? 1 : 0) +
    (opts.showAssignmentCol ? 1 : 0) +
    5
  );
}

function CraTableHeaderRow(opts: {
  showStudentCol: boolean;
  showModuleCol: boolean;
  showAssignmentCol: boolean;
  t: TFunction;
}) {
  return (
    <TableRow>
      {opts.showStudentCol ? <TableHead className="whitespace-nowrap">{opts.t('cra.table.student')}</TableHead> : null}
      {opts.showModuleCol ? <TableHead>{opts.t('cra.table.module')}</TableHead> : null}
      {opts.showAssignmentCol ? <TableHead>{opts.t('cra.table.assignment')}</TableHead> : null}
      <TableHead>{opts.t('cra.table.domain')}</TableHead>
      <TableHead>{opts.t('cra.table.skill')}</TableHead>
      <TableHead className="w-[7rem]">{opts.t('cra.table.percent')}</TableHead>
      <TableHead>{opts.t('cra.table.level')}</TableHead>
      <TableHead className="w-[5.5rem]" />
    </TableRow>
  );
}

type CraDataRowsListProps = CraRowOpts & { rows: EnrichedAssessment[] };

function CraDataRowsList({ rows: rowsIn, ...o }: CraDataRowsListProps) {
  const rows = sortEnrichedRows(rowsIn);
  const cc = craColCount(o);
  const renderList = (list: EnrichedAssessment[]) =>
    list.map((assessment) => {
      const id = assessment.id;
      const open = o.expanded.has(id);
      const perfBadge = o.getPerformanceBadge(assessment.current_level_percent);
      const panelId = `cra-hs-row-${id}`;
      const btnId = `cra-hs-btn-${id}`;
      const showInlinePanel = open && !o.isMobile;
      return (
        <Fragment key={id}>
          <TableRow>
            {o.showStudentCol ? (
              <TableCell className="whitespace-nowrap text-muted-foreground text-sm max-w-[10rem] truncate">
                {assessment.student_profiles?.full_name || o.t('cra.unknown')}
              </TableCell>
            ) : null}
            {o.showModuleCol ? <TableCell className="min-w-[7rem] text-sm">{assessment._sectionTitle}</TableCell> : null}
            {o.showAssignmentCol ? (
              <TableCell className="min-w-[8rem] text-sm">{assessment._assignmentTitle}</TableCell>
            ) : null}
            <TableCell className="font-medium">{assessment.domain}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="text-xs font-normal">
                {assessment.skill_component}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="w-full min-w-0 max-w-[8rem] space-y-1.5">
                <div
                  className={cn(
                    'text-base font-bold tabular-nums',
                    o.getPerformanceColor(assessment.current_level_percent),
                  )}
                >
                  {assessment.current_level_percent}%
                </div>
                <CraPercentBar
                  value={assessment.current_level_percent}
                  barClassName={o.getPerformanceBarClass(assessment.current_level_percent)}
                />
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={perfBadge.variant} className="text-xs">
                {perfBadge.label}
              </Badge>
            </TableCell>
            <TableCell>
              <Button
                id={btnId}
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 -my-0.5 rounded-full"
                onClick={() => o.onToggle(id)}
                aria-expanded={open}
                aria-controls={open ? (o.isMobile ? CRA_MOBILE_DIALOG_CONTENT_ID : panelId) : undefined}
                aria-haspopup={o.isMobile ? 'dialog' : undefined}
                aria-label={open ? o.t('cra.table.hideDetails') : o.t('cra.table.showDetails')}
              >
                <Info className="h-4 w-4" aria-hidden />
              </Button>
            </TableCell>
          </TableRow>
          {showInlinePanel ? (
            <TableRow>
              <TableCell
                colSpan={cc}
                id={panelId}
                role="region"
                aria-labelledby={btnId}
                className="bg-muted/25 align-top p-4 border-t"
              >
                <CraDetailBody assessment={assessment} t={o.t} />
              </TableCell>
            </TableRow>
          ) : null}
        </Fragment>
      );
    });

  if (o.groupByDomain) {
    return groupRowsByDomain(rows).map(({ domain, items }) => (
      <Fragment key={domain}>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableCell colSpan={cc} className="font-semibold text-sm py-2">
            {domain}
          </TableCell>
        </TableRow>
        {renderList(items)}
      </Fragment>
    ));
  }
  return <>{renderList(rows)}</>;
}

export function HardSkillsAssessmentTable({
  submissionId,
  assignmentId,
  classroomId,
  studentId,
  classroomAssignmentIdFilter,
  title,
  description,
  initialData,
  layout = 'grouped',
  defaultGroupByModule = true,
  defaultGroupByDomain = true,
}: HardSkillsAssessmentTableProps) {
  const { t } = useTranslation();
  const displayTitle = title || t('cra.title');
  const displayDescription = description || t('cra.description');
  const [assessments, setAssessments] = useState<HardSkillAssessmentWithStudent[]>(initialData || []);
  const [loading, setLoading] = useState(!initialData);
  const [groupByModule, setGroupByModule] = useState(defaultGroupByModule);
  const [groupByDomain, setGroupByDomain] = useState(defaultGroupByDomain);
  const isMobile = useIsMobile();

  const applyStudentNames = useCallback(
    async (data: HardSkillAssessmentWithStudent[]) => {
      if (data.length === 0 || submissionId) {
        return data;
      }
      const studentIds = [...new Set(data.map((a) => a.student_id))];
      const { data: profiles } = await supabase
        .from('student_profiles')
        .select('user_id, full_name')
        .in('user_id', studentIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
      return data.map((assessment) => ({
        ...assessment,
        student_profiles: { full_name: profileMap.get(assessment.student_id) || t('cra.unknown') },
      }));
    },
    [submissionId, t],
  );

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      let data: HardSkillAssessmentWithStudent[] = [];
      if (submissionId) {
        const { data: assessmentData, error } = await supabase
          .from('hard_skill_assessments')
          .select(CRA_SELECT)
          .eq('submission_id', submissionId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = (assessmentData || []) as unknown as HardSkillAssessmentWithStudent[];
      } else if (studentId && assignmentId === 'all' && classroomId) {
        if (classroomAssignmentIdFilter && classroomAssignmentIdFilter.length === 0) {
          setAssessments([]);
          return;
        }
        const { data: submissions } = await supabase
          .from('submissions')
          .select('id, assignment_id')
          .eq('student_id', studentId);
        if (submissions && submissions.length > 0) {
          const { data: asg } = await supabase
            .from('assignments')
            .select('id')
            .eq('classroom_id', classroomId);
          let classroomAssignmentIds = asg?.map((a) => a.id) || [];
          if (classroomAssignmentIdFilter && classroomAssignmentIdFilter.length > 0) {
            const allow = new Set(classroomAssignmentIdFilter);
            classroomAssignmentIds = classroomAssignmentIds.filter((id) => allow.has(id));
          }
          const validSubmissionIds = submissions
            .filter((s) => classroomAssignmentIds.includes(s.assignment_id))
            .map((s) => s.id);
          if (validSubmissionIds.length > 0) {
            const { data: assessmentData, error } = await supabase
              .from('hard_skill_assessments')
              .select(CRA_SELECT)
              .in('submission_id', validSubmissionIds)
              .order('created_at', { ascending: false });
            if (error) throw error;
            data = (assessmentData || []) as unknown as HardSkillAssessmentWithStudent[];
          }
        }
      } else if (studentId && assignmentId && assignmentId !== 'all') {
        const { data: assessmentData, error } = await supabase
          .from('hard_skill_assessments')
          .select(CRA_SELECT)
          .eq('student_id', studentId)
          .eq('assignment_id', assignmentId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = (assessmentData || []) as unknown as HardSkillAssessmentWithStudent[];
      } else if (assignmentId && assignmentId !== 'all' && classroomId) {
        const { data: assessmentData, error } = await supabase
          .from('hard_skill_assessments')
          .select(CRA_SELECT)
          .eq('assignment_id', assignmentId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        data = (assessmentData || []) as unknown as HardSkillAssessmentWithStudent[];
      } else {
        setAssessments([]);
        return;
      }
      const withNames = await applyStudentNames(data);
      setAssessments(withNames);
    } catch (e) {
      console.error('Error fetching hard skill assessments:', e);
    } finally {
      setLoading(false);
    }
  }, [
    submissionId,
    studentId,
    assignmentId,
    classroomId,
    classroomAssignmentIdFilter,
    applyStudentNames,
  ]);

  useEffect(() => {
    if (initialData) {
      let cancelled = false;
      setLoading(true);
      const needMeta = initialData.some((r) => !r.assignments?.title);
      if (!needMeta) {
        void (async () => {
          const withNames = await applyStudentNames(initialData);
          if (!cancelled) {
            setAssessments(withNames);
            setLoading(false);
          }
        })();
        return () => {
          cancelled = true;
        };
      }
      const ids = [...new Set(initialData.map((i) => i.assignment_id))];
      void (async () => {
        const { data: asgRows, error } = await supabase
          .from('assignments')
          .select('id, title, syllabus_section_id, syllabus_sections ( title, order_index )')
          .in('id', ids);
        if (cancelled) return;
        if (error) {
          const withNames = await applyStudentNames(initialData);
          if (!cancelled) {
            setAssessments(withNames);
            setLoading(false);
          }
          return;
        }
        const map = new Map((asgRows || []).map((a) => [a.id, a as HardSkillAssessmentWithStudent['assignments']]));
        const merged = initialData.map((r) => ({
          ...r,
          assignments: map.get(r.assignment_id) ?? r.assignments ?? null,
        }));
        const withNames = await applyStudentNames(merged);
        if (!cancelled) {
          setAssessments(withNames);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    void fetchAssessments();
    return undefined;
  }, [submissionId, assignmentId, classroomId, studentId, classroomAssignmentIdFilter, initialData, fetchAssessments, applyStudentNames]);

  const getPerformanceColor = (percent: number) => {
    if (percent >= 80) return 'text-green-600 dark:text-green-400';
    if (percent >= 60) return 'text-blue-600 dark:text-blue-400';
    if (percent >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const getPerformanceBarClass = (percent: number) => {
    if (percent >= 80) return 'bg-green-600 dark:bg-green-500';
    if (percent >= 60) return 'bg-blue-600 dark:bg-blue-500';
    if (percent >= 40) return 'bg-yellow-500 dark:bg-yellow-400';
    return 'bg-orange-500 dark:bg-orange-400';
  };

  const getPerformanceBadge = (percent: number) => {
    if (percent >= 80) return { label: t('cra.performance.advanced'), variant: 'default' as const };
    if (percent >= 60) return { label: t('cra.performance.intermediate'), variant: 'secondary' as const };
    if (percent >= 40) return { label: t('cra.performance.developing'), variant: 'outline' as const };
    return { label: t('cra.performance.beginner'), variant: 'outline' as const };
  };

  const enriched = useMemo(() => enrichAssessments(assessments as HardSkillAssessmentWithStudent[], t), [assessments, t]);
  const summary = useMemo(() => scopeSummaryText(enriched, t), [enriched, t]);

  const groupedTree = useMemo(() => {
    if (layout !== 'grouped') return null;
    const byModule = new Map<
      string,
      { order: number; title: string; byAssignment: Map<string, { title: string; rows: EnrichedAssessment[] }> }
    >();
    for (const r of enriched) {
      const modKey = r._sectionId ?? '__unplaced__';
      if (!byModule.has(modKey)) {
        byModule.set(modKey, {
          order: r._sectionOrder,
          title: r._sectionTitle,
          byAssignment: new Map(),
        });
      }
      const m = byModule.get(modKey)!;
      m.order = Math.min(m.order, r._sectionOrder);
      if (!m.byAssignment.has(r.assignment_id)) {
        m.byAssignment.set(r.assignment_id, { title: r._assignmentTitle, rows: [] });
      }
      m.byAssignment.get(r.assignment_id)!.rows.push(r);
    }
    const modules = [...byModule.entries()].sort((a, b) => {
      if (a[1].order !== b[1].order) return a[1].order - b[1].order;
      return a[1].title.localeCompare(b[1].title);
    });
    return { modules };
  }, [enriched, layout]);

  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => new Set());
  const toggleRow = useCallback(
    (id: string) => {
      setExpandedRowIds((prev) => {
        if (prev.has(id)) {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }
        if (isMobile) {
          return new Set([id]);
        }
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [isMobile],
  );

  const manyAssignmentsInView = useMemo(
    () => new Set(enriched.map((a) => a.assignment_id)).size > 1,
    [enriched],
  );

  const mobileDetailAssessment =
    isMobile && expandedRowIds.size > 0
      ? (enriched.find((a) => expandedRowIds.has(a.id)) ?? null)
      : null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{displayTitle}</CardTitle>
          <CardDescription>{displayDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (assessments.length === 0) {
    return null;
  }

  const showStudentCol = !submissionId;

  const tableShared: Pick<
    CraRowOpts,
    | 'expanded'
    | 'onToggle'
    | 'getPerformanceColor'
    | 'getPerformanceBarClass'
    | 'getPerformanceBadge'
    | 't'
    | 'submissionId'
    | 'isMobile'
  > = {
    expanded: expandedRowIds,
    onToggle: toggleRow,
    getPerformanceColor,
    getPerformanceBarClass,
    getPerformanceBadge,
    t,
    submissionId,
    isMobile,
  };

  const tableCaption = displayDescription
    ? `${displayTitle}. ${displayDescription}`
    : displayTitle;
  const tableClassName = 'min-w-[48rem] w-full';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {displayTitle}
        </CardTitle>
        <CardDescription>{displayDescription}</CardDescription>
        {layout === 'grouped' ? (
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:flex-wrap">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox
                checked={groupByModule}
                onCheckedChange={(v) => setGroupByModule(!!v)}
              />
              {t('cra.groupByModule')}
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Checkbox
                checked={groupByDomain}
                onCheckedChange={(v) => setGroupByDomain(!!v)}
              />
              {t('cra.groupByDomain')}
            </label>
          </div>
        ) : null}
        <p className="text-sm text-muted-foreground leading-relaxed pt-1">{summary}</p>
        {!isMobile ? (
          <p className="text-xs text-muted-foreground/90 hidden md:block pt-1">{t('cra.table.scrollHint')}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        {layout === 'flat' ? (
          <div className="overflow-x-auto rounded-xl border border-border" role="presentation">
            <Table className={tableClassName} aria-label={displayTitle}>
              <TableCaption className="sr-only">{tableCaption}</TableCaption>
              <TableHeader>
                <CraTableHeaderRow
                  showStudentCol={false}
                  showModuleCol={false}
                  showAssignmentCol={manyAssignmentsInView}
                  t={t}
                />
              </TableHeader>
              <TableBody>
                <CraDataRowsList
                  rows={enriched}
                  showStudentCol={false}
                  showModuleCol={false}
                  showAssignmentCol={manyAssignmentsInView}
                  groupByDomain={false}
                  {...tableShared}
                />
              </TableBody>
            </Table>
          </div>
        ) : groupedTree && groupByModule ? (
          groupedTree.modules.map(([modKey, mod]) => {
            const assignEntries = [...mod.byAssignment.entries()].sort((a, b) =>
              a[1].title.localeCompare(b[1].title),
            );
            const headCols = { showStudentCol, showModuleCol: false, showAssignmentCol: false as const };
            const cc = craColCount(headCols);
            return (
              <Collapsible
                key={modKey}
                className="border border-border rounded-xl bg-muted/15 overflow-hidden"
                defaultOpen
              >
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full flex items-center justify-between p-4 rounded-none h-auto hover:bg-muted/30"
                  >
                    <span className="font-semibold flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      {mod.title}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="p-2 pb-3">
                  <div className="overflow-x-auto rounded-lg border border-border/80 bg-card" role="presentation">
                    <Table className={tableClassName} aria-label={`${mod.title} — ${displayTitle}`}>
                      <TableCaption className="sr-only">{tableCaption}</TableCaption>
                      <TableHeader>
                        <CraTableHeaderRow showStudentCol={showStudentCol} showModuleCol={false} showAssignmentCol={false} t={t} />
                      </TableHeader>
                      <TableBody>
                        {assignEntries.map(([aid, { title, rows: ar }]) => (
                          <Fragment key={aid}>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              <TableCell colSpan={cc} className="font-medium text-sm py-2">
                                {title}
                              </TableCell>
                            </TableRow>
                            <CraDataRowsList
                              rows={ar}
                              showStudentCol={showStudentCol}
                              showModuleCol={false}
                              showAssignmentCol={false}
                              groupByDomain={groupByDomain}
                              {...tableShared}
                            />
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        ) : groupedTree && !groupByModule ? (
          (() => {
            const merged = mergeAllAssignmentsFromModules(groupedTree.modules);
            const all: EnrichedAssessment[] = [];
            for (const [, v] of merged) {
              all.push(...v.rows);
            }
            if (all.length === 0) return null;
            return (
              <div className="overflow-x-auto rounded-xl border border-border" role="presentation">
                <Table className={tableClassName} aria-label={displayTitle}>
                  <TableCaption className="sr-only">{tableCaption}</TableCaption>
                  <TableHeader>
                    <CraTableHeaderRow
                      showStudentCol={showStudentCol}
                      showModuleCol
                      showAssignmentCol
                      t={t}
                    />
                  </TableHeader>
                  <TableBody>
                    <CraDataRowsList
                      rows={all}
                      showStudentCol={showStudentCol}
                      showModuleCol
                      showAssignmentCol
                      groupByDomain={groupByDomain}
                      {...tableShared}
                    />
                  </TableBody>
                </Table>
              </div>
            );
          })()
        ) : null}
      </CardContent>
      <Dialog
        open={!!mobileDetailAssessment}
        onOpenChange={(o) => {
          if (!o) setExpandedRowIds(new Set());
        }}
      >
        <DialogContent
          className="max-h-[min(32rem,88vh)] overflow-y-auto sm:max-w-lg"
          id={CRA_MOBILE_DIALOG_CONTENT_ID}
        >
          {mobileDetailAssessment ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t('cra.table.detailsDialogTitle', {
                    domain: mobileDetailAssessment.domain,
                    skill: mobileDetailAssessment.skill_component,
                  })}
                </DialogTitle>
              </DialogHeader>
              <CraDetailBody assessment={mobileDetailAssessment} t={t} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function mergeAllAssignmentsFromModules(
  modules: [string, { byAssignment: Map<string, { title: string; rows: EnrichedAssessment[] }> }][],
) {
  const out = new Map<string, { title: string; rows: EnrichedAssessment[] }>();
  for (const [, mod] of modules) {
    for (const [aid, val] of mod.byAssignment) {
      if (!out.has(aid)) {
        out.set(aid, { title: val.title, rows: [...val.rows] });
      } else {
        out.get(aid)!.rows.push(...val.rows);
      }
    }
  }
  return out;
}

function groupRowsByDomain(rows: EnrichedAssessment[]) {
  const m = new Map<string, EnrichedAssessment[]>();
  for (const r of rows) {
    const d = r.domain;
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(r);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([domain, items]) => ({ domain, items }));
}
