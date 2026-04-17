import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Filter,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  LayoutGrid,
  LayoutTemplate,
  List,
  Rows3,
  Table2,
  Calendar,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  SubmissionCard,
  formatSubmissionAssignmentTitle,
  type SubmissionCardVariant,
} from './SubmissionCard';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useEnrichedClassroomSubmissions } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';

interface SubmissionsTabProps {
  classroomId: string;
}

export type SubmissionViewMode =
  | 'grid'
  | 'compact'
  | 'list'
  | 'detailed'
  | 'table'
  | 'timeline';

const VIEW_MODE_ICONS: Record<SubmissionViewMode, LucideIcon> = {
  list: List,
  grid: LayoutGrid,
  compact: LayoutTemplate,
  detailed: Rows3,
  table: Table2,
  timeline: Calendar,
};

/** Ensures Latin labels show a capital first letter when i18n or the control leaks raw values. */
function capitalizeLatinFirstLetter(s: string) {
  if (!s) return s;
  const c = s.charAt(0);
  if (c >= 'a' && c <= 'z') return c.toUpperCase() + s.slice(1);
  return s;
}

export function SubmissionsTab({ classroomId }: SubmissionsTabProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  // Filter states
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [viewMode, setViewMode] = useState<SubmissionViewMode>('list');

  const { data: submissions = [], isLoading: loading } = useEnrichedClassroomSubmissions(classroomId);

  // Get unique students and assignments from submissions for filters
  const students = useMemo(() => {
    return Array.from(
      new Map(
        submissions.map((s) => [s.student_id, { id: s.student_id, name: s.student_name }])
      ).values()
    );
  }, [submissions]);

  const assignments = useMemo(() => {
    return Array.from(
      new Map(
        submissions.map((s) => [s.assignment_id, { id: s.assignment_id, title: s.assignment_title }])
      ).values()
    );
  }, [submissions]);

  /** Rows per (student, assignment) — used to hide #1 when only one attempt exists. */
  const attemptCountByStudentAssignment = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of submissions) {
      const key = `${s.student_id}:${s.assignment_id}`;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [submissions]);

  // Memoize filtered submissions to avoid recalculating on every render
  const filteredSubmissions = useMemo(() => {
    // Use selectedStatus for filtering
    const effectiveStatus = selectedStatus;
    
    let filtered = [...submissions];

    if (selectedStudent !== 'all') {
      filtered = filtered.filter((s) => s.student_id === selectedStudent);
    }

    if (selectedAssignment !== 'all') {
      filtered = filtered.filter((s) => s.assignment_id === selectedAssignment);
    }

    if (effectiveStatus === 'completed') {
      filtered = filtered.filter((s) => s.has_feedback);
    } else if (effectiveStatus === 'in_progress') {
      filtered = filtered.filter((s) => !s.has_feedback);
    }

    if (startDate) {
      filtered = filtered.filter(s => new Date(s.submitted_at) >= new Date(startDate));
    }

    if (endDate) {
      // Add one day to include the end date fully
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      filtered = filtered.filter(s => new Date(s.submitted_at) < end);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        // Search in conversation context
        const conversationText =
          s.conversation_context
            ?.map((msg: any) => msg.content)
            .join(' ')
            .toLowerCase() || '';

        // Search in teacher feedback
        const feedbackText = s.teacher_feedback?.toLowerCase() || '';

        // Search in student name and assignment title
        const metaText = `${s.student_name} ${s.assignment_title}`.toLowerCase();

        return (
          conversationText.includes(query) ||
          feedbackText.includes(query) ||
          metaText.includes(query)
        );
      });
    }

    return filtered;
  }, [submissions, selectedStudent, selectedAssignment, selectedStatus, searchQuery, startDate, endDate]);

  const timelineSubmissions = useMemo(
    () =>
      [...filteredSubmissions].sort(
        (a, b) =>
          new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
      ),
    [filteredSubmissions],
  );

  const cardVariantForView = useMemo((): SubmissionCardVariant => {
    switch (viewMode) {
      case 'compact':
        return 'compact';
      case 'detailed':
        return 'detailed';
      case 'list':
        return 'list';
      case 'grid':
      default:
        return 'stack';
    }
  }, [viewMode]);

  const activeFiltersCount = [
    selectedStudent !== 'all',
    selectedAssignment !== 'all',
    selectedStatus !== 'all',
    startDate !== '',
    endDate !== ''
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedStudent('all');
    setSelectedAssignment('all');
    setSelectedStatus('all');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  const handleBulkExport = () => {
    if (submissions.length === 0) {
      toast.error(t('submissionsTab.noSubmissions'));
      return;
    }

    const report = submissions.map((sub) => ({
      student: sub.student_name,
      assignment: sub.assignment_title,
      submitted_at: new Date(sub.submitted_at).toLocaleString(),
      conversation: sub.conversation_context || [],
      teacher_feedback: sub.teacher_feedback || 'No feedback',
      has_feedback: sub.has_feedback,
    }));

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(t('submissionsTab.exportSuccess'));
  };

  const ViewModeIcon = VIEW_MODE_ICONS[viewMode];
  const viewModeDisplayLabel = capitalizeLatinFirstLetter(t(`submissionsTab.view.${viewMode}`));

  if (loading && submissions.length === 0) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse">{t('common.loading')}</div>;
  }

  if (submissions.length === 0) {
    return (
      <Card className="rounded-xl border-dashed border-2 border-border bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center shadow-sm mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className={`text-xl font-bold text-foreground mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('submissionsTab.noSubmissionsYet')}
          </h3>
          <p className={`text-muted-foreground max-w-md ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('submissionsTab.noSubmissionsDesc')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-none shadow-sm bg-card ring-1 ring-border overflow-hidden">
        <CardContent className="p-6">
          <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <div className="space-y-4">
              {/* Top Row: Search, Filter Toggle, Export */}
              <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
                <div className="relative flex-1 w-full min-w-0">
                  <Search
                    className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground`}
                  />
                  <Input
                    placeholder={t('submissionsTab.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`${isRTL ? 'pr-12' : 'pl-12'} h-12 rounded-full border-border bg-muted/30 focus:bg-card transition-all text-base shadow-sm text-foreground`}
                  />
                </div>

                <div className="flex gap-4 w-full md:w-auto flex-wrap items-center">
                  <Select
                    value={viewMode}
                    onValueChange={(v) => setViewMode(v as SubmissionViewMode)}
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <SelectTrigger
                      className="rounded-xl h-10 min-h-10 w-full min-w-0 border-border bg-muted/30 text-sm text-foreground sm:w-auto sm:min-w-[160px] [&_svg:not([class*='size-'])]:size-4"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <SelectValue>
                        <span className="flex items-center gap-2 min-w-0">
                          <ViewModeIcon className="size-4 shrink-0 opacity-90" aria-hidden />
                          <span className="truncate">{viewModeDisplayLabel}</span>
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-card border-border" dir={isRTL ? 'rtl' : 'ltr'} align="start">
                      <SelectItem value="list">
                        <List className="h-4 w-4" />
                        <span>{capitalizeLatinFirstLetter(t('submissionsTab.view.list'))}</span>
                      </SelectItem>
                      <SelectItem value="grid">
                        <LayoutGrid className="h-4 w-4" />
                        <span>{capitalizeLatinFirstLetter(t('submissionsTab.view.grid'))}</span>
                      </SelectItem>
                      <SelectItem value="compact">
                        <LayoutTemplate className="h-4 w-4" />
                        <span>{capitalizeLatinFirstLetter(t('submissionsTab.view.compact'))}</span>
                      </SelectItem>
                      <SelectItem value="detailed">
                        <Rows3 className="h-4 w-4" />
                        <span>{capitalizeLatinFirstLetter(t('submissionsTab.view.detailed'))}</span>
                      </SelectItem>
                      <SelectItem value="table">
                        <Table2 className="h-4 w-4" />
                        <span>{capitalizeLatinFirstLetter(t('submissionsTab.view.table'))}</span>
                      </SelectItem>
                      <SelectItem value="timeline">
                        <Calendar className="h-4 w-4" />
                        <span>{capitalizeLatinFirstLetter(t('submissionsTab.view.timeline'))}</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full md:w-auto rounded-full h-12 px-6 border-border ${isFiltersOpen || activeFiltersCount > 0 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-card'}`}
                    >
                      <Filter className="h-4 w-4 me-2" />
                      {t('common.advancedFilters')}
                      {activeFiltersCount > 0 && (
                        <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary hover:bg-primary/30 rounded-full w-5 h-5 p-0 flex items-center justify-center text-[10px]">
                          {activeFiltersCount}
                        </Badge>
                      )}
                      {isFiltersOpen ? <ChevronUp className="h-4 w-4 ms-2" /> : <ChevronDown className="h-4 w-4 ms-2" />}
                    </Button>
                  </CollapsibleTrigger>

                  <Button
                    onClick={handleBulkExport}
                    disabled={submissions.length === 0}
                    variant="outline"
                    className="rounded-full h-12 px-4 border-border hover:bg-muted/50"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Advanced Filters panel (same Collapsible root as trigger) */}
              <CollapsibleContent className="overflow-hidden">
                <div className="pt-2 flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6 sm:gap-y-4 md:gap-x-8 lg:gap-x-10">
                  <div className="space-y-1.5 w-full min-w-0 sm:w-auto sm:shrink-0 sm:min-w-[160px]">
                    <label className={`text-xs font-medium text-muted-foreground ms-1 block ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.student')}</label>
                    <Select value={selectedStudent} onValueChange={setSelectedStudent} dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectTrigger className="rounded-xl h-10 min-w-[160px] border-border bg-muted/30 text-sm text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue>
                          {selectedStudent === 'all' ? t('submissionsTab.allStudents') : students.find(s => s.id === selectedStudent)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl bg-card border-border" dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectItem value="all">{t('submissionsTab.allStudents')}</SelectItem>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 w-full min-w-0 sm:w-auto sm:shrink-0 sm:min-w-[160px]">
                    <label className={`text-xs font-medium text-muted-foreground ms-1 block ${isRTL ? 'text-right' : 'text-left'}`}>{t('submissionsTab.assignment')}</label>
                    <Select value={selectedAssignment} onValueChange={setSelectedAssignment} dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectTrigger className="rounded-xl h-10 min-w-[160px] border-border bg-muted/30 text-sm text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue>
                          {selectedAssignment === 'all' ? t('submissionsTab.allAssignments') : assignments.find(a => a.id === selectedAssignment)?.title}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl bg-card border-border" dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectItem value="all">{t('submissionsTab.allAssignments')}</SelectItem>
                        {assignments.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 w-full min-w-0 sm:w-auto sm:shrink-0 sm:min-w-[160px]">
                    <label className={`text-xs font-medium text-muted-foreground ms-1 block ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus} dir={isRTL ? 'rtl' : 'ltr'}>
                      <SelectTrigger className="rounded-xl h-10 min-w-[160px] border-border bg-muted/30 text-sm text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectValue>
                          {selectedStatus === 'all' ? t('submissionsTab.allStatuses') : (selectedStatus === 'in_progress' ? t('submissionsTab.inProgress') : t('submissionCard.completed'))}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="rounded-xl bg-card border-border" dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectItem value="all">{t('submissionsTab.allStatuses')}</SelectItem>
                        <SelectItem value="completed">{t('common.completed')}</SelectItem>
                        <SelectItem value="in_progress">{t('submissionsTab.inProgress')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 w-full min-w-0 sm:w-auto sm:shrink-0 sm:min-w-[280px] sm:max-w-[340px]">
                    <label className={`text-xs font-medium text-muted-foreground ms-1 block ${isRTL ? 'text-right' : 'text-left'}`}>{t('submissionsTab.dateRange')}</label>
                    <div className="flex gap-4 sm:gap-5">
                      <div className="relative flex-1 min-w-0">
                        <DatePicker value={startDate} onChange={setStartDate} placeholder={t('submissionsTab.from', 'From')} className="rounded-xl h-10 border-border bg-muted/30 text-xs" />
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <DatePicker value={endDate} onChange={setEndDate} placeholder={t('submissionsTab.to', 'To')} className="rounded-xl h-10 border-border bg-muted/30 text-xs" />
                      </div>
                    </div>
                  </div>
                </div>

                {activeFiltersCount > 0 && (
                  <div className={`flex mt-4 ${isRTL ? 'justify-start' : 'justify-end'}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                    >
                      <X className="h-3.5 w-3.5 me-1.5" />
                      {t('submissionsTab.clearFilters')}
                    </Button>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>
        </CardContent>
      </Card>

      {filteredSubmissions.length === 0 ? (
        <Card className="rounded-xl border-dashed border-2 border-border bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center shadow-sm mb-3">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className={`text-lg font-bold text-foreground mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('submissionsTab.noMatches')}
            </h3>
            <p className={`text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('submissionsTab.adjustFilters')}
            </p>
            {activeFiltersCount > 0 && (
              <Button variant="link" onClick={clearFilters} className="mt-2 text-primary">
                {t('submissionsTab.clearAllFilters')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <div
          className="rounded-xl border border-border bg-card ring-1 ring-border overflow-hidden"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t('submissionsTab.tableAssignment')}</TableHead>
                <TableHead className="text-start">{t('submissionsTab.tableStudent')}</TableHead>
                <TableHead className="text-start">{t('submissionsTab.tableStatus')}</TableHead>
                <TableHead className="text-start">{t('submissionsTab.tableSubmitted')}</TableHead>
                <TableHead className="text-start">{t('submissionsTab.tableMessages')}</TableHead>
                <TableHead className="text-start min-w-[140px]">{t('submissionsTab.tableFeedback')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubmissions.map((submission) => {
                const pending = submission.id.startsWith('pending-');
                const msgCount = submission.conversation_context?.length ?? 0;
                let feedbackText: string;
                if (pending) {
                  feedbackText = '—';
                } else if (!submission.has_feedback) {
                  feedbackText = t('submissionCard.awaitingFeedback');
                } else if (submission.teacher_feedback?.trim()) {
                  const plain = submission.teacher_feedback
                    .replace(/\*\*/g, '')
                    .replace(/\n/g, ' ')
                    .trim();
                  feedbackText = plain.length > 120 ? `${plain.slice(0, 120)}…` : plain;
                } else {
                  feedbackText = t('submissionCard.feedbackRecorded');
                }
                return (
                  <TableRow
                    key={submission.id}
                    className={cn(!pending && 'cursor-pointer')}
                    onClick={() => {
                      if (!pending) navigate(`/teacher/submission/${submission.id}`);
                    }}
                  >
                    <TableCell className="max-w-[min(100%,280px)] whitespace-normal align-middle text-start font-medium">
                      {formatSubmissionAssignmentTitle(
                        submission.assignment_title,
                        submission.attempt_number,
                        attemptCountByStudentAssignment.get(`${submission.student_id}:${submission.assignment_id}`) ?? 1,
                      )}
                    </TableCell>
                    <TableCell className="text-start align-middle">{submission.student_name}</TableCell>
                    <TableCell className="align-middle">
                      <Badge
                        variant={submission.has_feedback ? 'default' : 'secondary'}
                        className={cn(
                          'rounded-full px-2 py-0.5 font-medium text-[10px]',
                          submission.has_feedback
                            ? 'bg-success/20 text-success dark:bg-success/30 dark:text-success-foreground'
                            : 'bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-400',
                        )}
                      >
                        {pending
                          ? t('submissionCard.notStarted')
                          : submission.has_feedback
                            ? t('submissionCard.completed')
                            : t('submissionCard.inProgress')}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground align-middle whitespace-nowrap">
                      {new Date(submission.submitted_at).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground align-middle">
                      {pending ? '—' : msgCount}
                    </TableCell>
                    <TableCell className="align-middle text-muted-foreground max-w-[min(100vw,320px)] whitespace-normal text-start text-xs">
                      {feedbackText}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : viewMode === 'timeline' ? (
        <div
          className="relative space-y-0 ps-6 sm:ps-8 border-s border-border ms-3 sm:ms-4"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {timelineSubmissions.map((submission) => (
            <div key={submission.id} className="relative pb-8 last:pb-0">
              <div
                className="-start-[22px] sm:-start-[26px] absolute top-2 size-3 rounded-full bg-primary ring-4 ring-background"
                aria-hidden
              />
              <SubmissionCard
                submission={submission}
                variant="detailed"
                submissionAttemptCount={
                  attemptCountByStudentAssignment.get(`${submission.student_id}:${submission.assignment_id}`) ?? 1
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          className={cn(
            viewMode === 'grid' && 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
            viewMode === 'compact' &&
              'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2',
            viewMode === 'list' && 'flex flex-col gap-2 w-full max-w-4xl',
            viewMode === 'detailed' && 'grid grid-cols-1 lg:grid-cols-2 gap-6',
          )}
        >
          {filteredSubmissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              variant={cardVariantForView}
              submissionAttemptCount={
                attemptCountByStudentAssignment.get(`${submission.student_id}:${submission.assignment_id}`) ?? 1
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
