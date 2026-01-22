import { useState, useMemo } from 'react';
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
import { FileText, Filter, Download, Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { SubmissionCard } from './SubmissionCard';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { useEnrichedClassroomSubmissions } from '@/hooks/queries';

interface SubmissionsTabProps {
  classroomId: string;
}

export function SubmissionsTab({ classroomId }: SubmissionsTabProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  
  // Filter states
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

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
      toast.error(t('components.submissions.noSubmissions'));
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

    toast.success(t('components.submissions.exportSuccess'));
  };

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
          <div className="space-y-4">
            {/* Top Row: Search, Filter Toggle, Export */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
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

              <div className="flex gap-2 w-full md:w-auto">
                <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen} className="w-full md:w-auto">
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
                </Collapsible>

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

            {/* Collapsible Advanced Filters */}
            <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <CollapsibleContent className="animate-in slide-in-from-top-2 fade-in duration-300">
                <div className="pt-4 mt-2 border-t border-border grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
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

                  <div className="space-y-1.5">
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

                  <div className="space-y-1.5">
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

                  <div className="space-y-1.5">
                    <label className={`text-xs font-medium text-muted-foreground ms-1 block ${isRTL ? 'text-right' : 'text-left'}`}>{t('submissionsTab.dateRange')}</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="rounded-xl h-10 border-border bg-muted/30 text-xs px-2 text-foreground"
                        />
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="rounded-xl h-10 border-border bg-muted/30 text-xs px-2 text-foreground"
                        />
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
            </Collapsible>
          </div>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubmissions.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  );
}
