import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { FileText, Filter, Download, Search } from 'lucide-react';
import { SubmissionCard } from './SubmissionCard';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
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
  }, [submissions, selectedStudent, selectedAssignment, searchQuery]);

  const handleBulkExport = () => {
    if (submissions.length === 0) {
      toast.error('No submissions to export');
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

    toast.success('Report exported successfully');
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
        .select('user_id, full_name')
        .in('user_id', studentIds);

      // Fetch all feedback in one query
      const { data: feedbackData } = await supabase
        .from('assignment_feedback')
        .select('submission_id, teacher_feedback, conversation_context')
        .in('submission_id', submissionIds);

      // Create lookup maps for fast access
      const studentMap = new Map(studentProfiles?.map((s) => [s.user_id, s.full_name]) || []);

      const assignmentMap = new Map(assignData.map((a) => [a.id, a.title]));

      const feedbackMap = new Map(feedbackData?.map((f) => [f.submission_id, f]) || []);

      // Enrich submissions with all data in memory
      const enrichedSubmissions: SubmissionWithDetails[] = submissionsData.map((sub) => {
        const feedback = feedbackMap.get(sub.id);

        return {
          ...sub,
          student_name: studentMap.get(sub.student_id) || 'Unknown',
          assignment_title: assignmentMap.get(sub.assignment_id) || 'Unknown Assignment',
          has_feedback: !!feedback,
          teacher_feedback: feedback?.teacher_feedback || undefined,
          conversation_context: Array.isArray(feedback?.conversation_context)
            ? feedback.conversation_context
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
      toast.error('Error loading submissions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>;
  }

  if (submissions.length === 0) {
    return (
      <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
            <FileText className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No submissions yet</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md">
            Student submissions will appear here when they complete assignments
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                <Filter className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              {t('submissionsTab.filterTitle')}
            </CardTitle>
            <Button
              onClick={handleBulkExport}
              disabled={submissions.length === 0}
              size="sm"
              className="w-full sm:w-auto rounded-full shadow-sm hover:shadow-md transition-all"
              variant="outline"
            >
              <Download className="h-4 w-4 me-2" />
              {t('submissionsTab.exportAll')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">{t('submissionsTab.search')}</label>
              <div className="relative">
                <Search
                  className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400`}
                />
                <Input
                  placeholder={t('submissionsTab.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${isRTL ? 'pr-10' : 'pl-10'} rounded-full border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 transition-all`}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">{t('common.student')}</label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger className="rounded-full border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700">
                    <SelectItem value="all">{t('submissionsTab.allStudents')}</SelectItem>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                  {t('submissionsTab.assignment')}
                </label>
                <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                  <SelectTrigger className="rounded-full border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-700">
                    <SelectItem value="all">{t('submissionsTab.allAssignments')}</SelectItem>
                    {assignments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredSubmissions.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-3">
              <Search className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{t('submissionsTab.noMatches')}</h3>
            <p className="text-slate-500 dark:text-slate-400">{t('submissionsTab.adjustFilters')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSubmissions.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  );
}
