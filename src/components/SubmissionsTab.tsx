import { useEffect, useState, useMemo } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { FileText, Filter, Download, Search, ChevronDown, ChevronUp, Calendar as CalendarIcon, X } from 'lucide-react';
import { SubmissionCard } from './SubmissionCard';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';

interface SubmissionsTabProps {
  classroomId: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SubmissionWithDetails {
  id: string;
  submitted_at: string;
  student_id: string;
  assignment_id: string;
  student_name: string;
  student_avatar_url?: string;
  assignment_title: string;
  has_feedback: boolean;
  teacher_feedback?: string;
  conversation_context?: ConversationMessage[];
}

interface Student {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  title: string;
}

export function SubmissionsTab({ classroomId }: SubmissionsTabProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Filter states
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions();
  }, [classroomId]);

  // Memoize filtered submissions to avoid recalculating on every render
  const filteredSubmissions = useMemo(() => {
    let filtered = [...submissions];

    if (selectedStudent !== 'all') {
      filtered = filtered.filter((s) => s.student_id === selectedStudent);
    }

    if (selectedAssignment !== 'all') {
      filtered = filtered.filter((s) => s.assignment_id === selectedAssignment);
    }

    if (selectedStatus !== 'all') {
      if (selectedStatus === 'completed') {
        filtered = filtered.filter((s) => s.has_feedback);
      } else if (selectedStatus === 'in_progress') {
        filtered = filtered.filter((s) => !s.has_feedback);
      }
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
            ?.map((msg) => msg.content)
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

  const fetchSubmissions = async () => {
    try {
      // Get all assignments in this classroom
      const { data: assignData } = await supabase
        .from('assignments')
        .select('id, title')
        .eq('classroom_id', classroomId);

      if (!assignData || assignData.length === 0) {
        setSubmissions([]);
        setAssignments([]);
        setLoading(false);
        return;
      }

      setAssignments(assignData);
      const assignmentIds = assignData.map((a) => a.id);

      // Get all submissions for these assignments
      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('id, submitted_at, student_id, assignment_id')
        .in('assignment_id', assignmentIds)
        .order('submitted_at', { ascending: false });

      if (!submissionsData || submissionsData.length === 0) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      // Bulk fetch all data to avoid N+1 queries
      const submissionIds = submissionsData.map((s) => s.id);
      const studentIds = [...new Set(submissionsData.map((s) => s.student_id))];

      // Fetch all student profiles in one query
      const { data: studentProfiles } = await supabase
        .from('student_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', studentIds);

      // Fetch all feedback in one query
      const { data: feedbackData } = await supabase
        .from('assignment_feedback')
        .select('submission_id, teacher_feedback, conversation_context')
        .in('submission_id', submissionIds);

      // Create lookup maps for fast access
      const studentMap = new Map(studentProfiles?.map((s) => [s.user_id, { name: s.full_name, avatar: s.avatar_url }]) || []);

      const assignmentMap = new Map(assignData.map((a) => [a.id, a.title]));

      const feedbackMap = new Map(feedbackData?.map((f) => [f.submission_id, f]) || []);

      // Enrich submissions with all data in memory
      const enrichedSubmissions: SubmissionWithDetails[] = submissionsData.map((sub) => {
        const feedback = feedbackMap.get(sub.id);
        const studentInfo = studentMap.get(sub.student_id);

        return {
          ...sub,
          student_name: studentInfo?.name || 'Unknown',
          student_avatar_url: studentInfo?.avatar || undefined,
          assignment_title: assignmentMap.get(sub.assignment_id) || 'Unknown Assignment',
          has_feedback: !!feedback,
          teacher_feedback: feedback?.teacher_feedback || undefined,
          conversation_context: Array.isArray(feedback?.conversation_context)
            ? (feedback.conversation_context as any) as ConversationMessage[]
            : [],
        };
      });

      setSubmissions(enrichedSubmissions);

      // Get unique students
      const uniqueStudents = Array.from(
        new Map(
          enrichedSubmissions.map((s) => [s.student_id, { id: s.student_id, name: s.student_name }])
        ).values()
      );
      setStudents(uniqueStudents);
    } catch (error) {
      toast.error(t('components.submissions.loadError'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground animate-pulse">{t('common.loading')}</div>;
  }

  if (submissions.length === 0) {
    return (
      <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
            <FileText className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className={`text-xl font-bold text-slate-800 dark:text-slate-100 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('submissionsTab.noSubmissionsYet')}
          </h3>
          <p className={`text-slate-500 dark:text-slate-400 max-w-md ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('submissionsTab.noSubmissionsDesc')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Top Row: Search, Filter Toggle, Export */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search
                  className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400`}
                />
                <Input
                  placeholder={t('submissionsTab.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${isRTL ? 'pr-12' : 'pl-12'} h-12 rounded-full border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 transition-all text-base shadow-sm`}
                />
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen} className="w-full md:w-auto">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full md:w-auto rounded-full h-12 px-6 border-slate-200 dark:border-slate-700 ${isFiltersOpen || activeFiltersCount > 0 ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' : 'bg-white dark:bg-slate-800'}`}
                    >
                      <Filter className="h-4 w-4 me-2" />
                      {t('common.advancedFilters')}
                      {activeFiltersCount > 0 && (
                        <Badge variant="secondary" className="ml-2 bg-indigo-200 text-indigo-700 hover:bg-indigo-300 dark:bg-indigo-800 dark:text-indigo-200">
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
                  className="rounded-full h-12 px-4 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Collapsible Advanced Filters */}
            <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <CollapsibleContent className="animate-in slide-in-from-top-2 fade-in duration-300">
                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <label className={`text-xs font-medium text-slate-500 dark:text-slate-400 ms-1 block ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.student')}</label>
                    <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                      <SelectTrigger className="rounded-xl h-10 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
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
                    <label className={`text-xs font-medium text-slate-500 dark:text-slate-400 ms-1 block ${isRTL ? 'text-right' : 'text-left'}`}>{t('submissionsTab.assignment')}</label>
                    <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                      <SelectTrigger className="rounded-xl h-10 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
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
                    <label className={`text-xs font-medium text-slate-500 dark:text-slate-400 ms-1 block ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="rounded-xl h-10 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                        <SelectItem value="all">{t('submissionsTab.allStatuses')}</SelectItem>
                        <SelectItem value="completed">{t('common.completed')}</SelectItem>
                        <SelectItem value="in_progress">{t('submissionsTab.inProgress')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={`text-xs font-medium text-slate-500 dark:text-slate-400 ms-1 block ${isRTL ? 'text-right' : 'text-left'}`}>{t('submissionsTab.dateRange')}</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 min-w-0">
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="rounded-xl h-10 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs px-2"
                        />
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="rounded-xl h-10 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs px-2"
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
                      className="text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-full"
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
        <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-3">
              <Search className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className={`text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('submissionsTab.noMatches')}
            </h3>
            <p className={`text-slate-500 dark:text-slate-400 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('submissionsTab.adjustFilters')}
            </p>
            {activeFiltersCount > 0 && (
              <Button variant="link" onClick={clearFilters} className="mt-2 text-indigo-600">
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
