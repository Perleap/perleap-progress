import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, BookOpen, Calendar, FileText, Clock, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { BreathingBackground } from '@/components/ui/BreathingBackground';
import { cn } from '@/lib/utils';

interface Classroom {
  id: string;
  name: string;
  subject: string;
  course_title: string;
  course_duration: string;
  start_date: string;
  end_date: string;
  course_outline: string;
  resources: string;
  learning_outcomes: string[];
  key_challenges: string[];
}

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  due_at: string;
  status: string;
  type: string;
}

const StudentClassroomDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [finishedAssignments, setFinishedAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'due-date'>('due-date');
  const [assignmentsSubTab, setAssignmentsSubTab] = useState<'active' | 'finished'>('active');
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastIdRef = useRef(id);
  const lastUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // ProtectedRoute handles auth, just fetch data when user is available
    if (!user?.id) return;

    // Reset refs if classroom ID or user ID changes
    if (lastIdRef.current !== id || lastUserIdRef.current !== user.id) {
      hasFetchedRef.current = false;
      isFetchingRef.current = false;
      lastIdRef.current = id;
      lastUserIdRef.current = user.id;
    }

    // Only fetch if we haven't fetched yet and we're not currently fetching
    if (!hasFetchedRef.current && !isFetchingRef.current) {
      fetchData();
    }
  }, [id, user?.id]); // Use user?.id to avoid refetch on user object reference change

  const fetchData = async () => {
    if (isFetchingRef.current) return; // Prevent concurrent fetches

    isFetchingRef.current = true;

    try {
      // Check enrollment and fetch classroom
      const { data: enrollment, error: enrollError } = await supabase
        .from('enrollments')
        .select('classroom_id, classrooms(*)')
        .eq('student_id', user?.id)
        .eq('classroom_id', id)
        .maybeSingle();

      if (enrollError) throw enrollError;

      if (!enrollment) {
        toast.error(t('studentClassroom.errors.loading'));
        navigate('/student/dashboard');
        return;
      }

      setClassroom(enrollment.classrooms as any);

      // Fetch assignments
      const { data: assignmentsData, error: assignError } = await supabase
        .from('assignments')
        .select('*')
        .eq('classroom_id', id)
        .eq('status', 'published')
        .order('due_at', { ascending: true });

      if (assignError) throw assignError;

      if (assignmentsData && assignmentsData.length > 0) {
        // Fetch submissions for this student
        const assignmentIds = assignmentsData.map((a) => a.id);
        const { data: submissionsData } = await supabase
          .from('submissions')
          .select('id, assignment_id')
          .eq('student_id', user?.id)
          .in('assignment_id', assignmentIds);

        // Fetch feedback to determine which assignments are truly completed
        const submissionIds = submissionsData?.map(s => s.id) || [];
        let finishedAssignmentIds = new Set<string>();

        if (submissionIds.length > 0) {
          const { data: feedbackData } = await supabase
            .from('assignment_feedback')
            .select('submission_id')
            .in('submission_id', submissionIds);

          const completedSubmissionIds = new Set(feedbackData?.map(f => f.submission_id) || []);
          const submissionMap = new Map(submissionsData?.map(s => [s.id, s.assignment_id]) || []);

          // Only mark as finished if feedback exists
          finishedAssignmentIds = new Set(
            Array.from(completedSubmissionIds)
              .map(subId => submissionMap.get(subId))
              .filter((id): id is string => id !== undefined)
          );
        }

        // Separate active and finished assignments based on feedback existence
        const active = assignmentsData.filter(a => !finishedAssignmentIds.has(a.id));
        const finished = assignmentsData.filter(a => finishedAssignmentIds.has(a.id));

        setAssignments(active);
        setFinishedAssignments(finished);
      } else {
        setAssignments([]);
        setFinishedAssignments([]);
      }

      // Student analytics removed - only for teachers
    } catch (error) {
      toast.error(t('studentClassroom.errors.loading'));
      navigate('/student/dashboard');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
    }
  };

  const getSortedAssignments = (assignmentsList: Assignment[] = assignments) => {
    const sorted = [...assignmentsList];
    switch (sortBy) {
      case 'recent':
        // Newest received first - reverse the default order
        return sorted.reverse();
      case 'oldest':
        // Oldest first - keep default order (already sorted by due_at ascending)
        return sorted;
      case 'due-date':
        // Earliest due date first
        return sorted.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
      default:
        return sorted;
    }
  };

  if (loading) {
    return (
      <BreathingBackground className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-indigo-600 font-medium animate-pulse">{t('common.loading')}</p>
        </div>
      </BreathingBackground>
    );
  }

  if (!classroom) return null;

  return (
    <BreathingBackground className="min-h-screen">
      <DashboardHeader
        title={classroom.name}
        subtitle={classroom.subject}
        userType="student"
        showBackButton
        onBackClick={() => navigate('/student/dashboard')}
      />

      <main className="container py-6 md:py-10 px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          <Tabs defaultValue="overview" className="space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex justify-center">
              <TabsList className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-1 rounded-full border border-white/20 shadow-sm">
                <TabsTrigger
                  value="overview"
                  className="rounded-full px-6 py-2 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900/50 dark:data-[state=active]:text-indigo-300 transition-all"
                >
                  {t('studentClassroom.about')}
                </TabsTrigger>
                <TabsTrigger
                  value="assignments"
                  className="rounded-full px-6 py-2 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900/50 dark:data-[state=active]:text-indigo-300 transition-all"
                >
                  {t('studentClassroom.assignments')}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Main Info Card */}
                <Card className="md:col-span-2 border-none shadow-lg rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                  <div className="h-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-3 text-2xl ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                        <BookOpen className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      {t('studentClassroom.courseInfo')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {classroom.course_title && (
                      <div>
                        <h3 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('studentClassroom.courseTitle')}</h3>
                        <p className={`text-lg font-medium text-slate-800 dark:text-slate-200 ${isRTL ? 'text-right' : 'text-left'}`}>{classroom.course_title}</p>
                      </div>
                    )}

                    {classroom.course_outline && (
                      <div>
                        <h3 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('studentClassroom.courseOutline')}</h3>
                        <div className={`bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}>
                          {classroom.course_outline}
                        </div>
                      </div>
                    )}

                    {classroom.resources && (
                      <div>
                        <h3 className={`text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('studentClassroom.resources')}</h3>
                        <div className={`bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed border border-blue-100 dark:border-blue-900/20 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {classroom.resources}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Sidebar Info */}
                <div className="space-y-6">
                  <Card className="border-none shadow-md rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                    <CardHeader className="pb-3">
                      <CardTitle className={`text-lg flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <Calendar className="h-5 w-5 text-orange-500" />
                        {t('studentClassroom.schedule')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {classroom.course_duration && (
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('studentClassroom.duration')}</p>
                            <p className="font-medium">{classroom.course_duration}</p>
                          </div>
                        </div>
                      )}

                      {(classroom.start_date || classroom.end_date) && (
                        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {classroom.start_date && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">{t('studentClassroom.startDate')}</span>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                {new Date(classroom.start_date).toLocaleDateString()}
                              </Badge>
                            </div>
                          )}
                          {classroom.end_date && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">{t('studentClassroom.endDate')}</span>
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                {new Date(classroom.end_date).toLocaleDateString()}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
                    <Card className="border-none shadow-md rounded-3xl bg-emerald-50/50 dark:bg-emerald-900/10 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CardHeader className="pb-3">
                        <CardTitle className={`text-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-300 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <CheckCircle2 className="h-5 w-5" />
                          {t('studentClassroom.learningOutcomes')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {classroom.learning_outcomes.map((outcome, index) => (
                            <li key={index} className={`flex items-start gap-2 text-sm text-emerald-900 dark:text-emerald-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                              <span>{outcome}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                    <Card className="border-none shadow-md rounded-3xl bg-amber-50/50 dark:bg-amber-900/10 backdrop-blur-sm overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CardHeader className="pb-3">
                        <CardTitle className={`text-lg flex items-center gap-2 text-amber-800 dark:text-amber-300 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <AlertCircle className="h-5 w-5" />
                          {t('studentClassroom.keyChallenges')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {classroom.key_challenges.map((challenge, index) => (
                            <li key={index} className={`flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                              <span>{challenge}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="assignments" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-white/60 dark:bg-slate-900/60 p-4 rounded-3xl backdrop-blur-sm shadow-sm">
                <Tabs value={assignmentsSubTab} onValueChange={(v) => setAssignmentsSubTab(v as 'active' | 'finished')} className="w-full sm:w-auto">
                  <TabsList className="bg-slate-100 dark:bg-slate-800 rounded-full p-1 h-10">
                    <TabsTrigger value="active" className="rounded-full px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">{t('common.active')}</TabsTrigger>
                    <TabsTrigger value="finished" className="rounded-full px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm">{t('common.finished')}</TabsTrigger>
                  </TabsList>
                </Tabs>

                {(assignmentsSubTab === 'active' ? assignments.length > 0 : finishedAssignments.length > 0) && (
                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as typeof sortBy)}
                  >
                    <SelectTrigger className="w-[180px] rounded-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <SelectValue placeholder={t('studentDashboard.sortBy')} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="due-date">{t('studentDashboard.sortOptions.dueDate')}</SelectItem>
                      <SelectItem value="recent">{t('studentDashboard.sortOptions.recent')}</SelectItem>
                      <SelectItem value="oldest">{t('studentDashboard.sortOptions.oldest')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {assignmentsSubTab === 'active' ? (
                assignments.length === 0 ? (
                  <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
                        <Sparkles className="h-8 w-8 text-indigo-500" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-200">
                        {t('studentClassroom.noAssignments')}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 max-w-md">
                        {t('studentClassroom.noAssignmentsDesc')}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {getSortedAssignments().map((assignment) => (
                      <Card
                        key={assignment.id}
                        className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-none shadow-md rounded-3xl bg-white dark:bg-slate-900 overflow-hidden hover:-translate-y-1"
                        onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                      >
                        <div className="flex flex-col md:flex-row">
                          <div className={`p-6 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                            <div className="flex items-center gap-3 mb-3">
                              <Badge className={cn(
                                "rounded-full px-3 py-1",
                                assignment.type === 'quiz' ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              )}>
                                {assignment.type.replace('_', ' ')}
                              </Badge>
                              {assignment.due_at && (
                                <span className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5" />
                                  {t('common.due')}: {new Date(assignment.due_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>

                            <h3 className={`text-xl font-bold mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${isRTL ? 'text-right' : 'text-left'}`}>
                              {assignment.title}
                            </h3>

                            <p className={`text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 ${isRTL ? 'text-right' : 'text-left'}`}>
                              {assignment.instructions}
                            </p>

                            <Button variant="outline" className="rounded-full group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-all">
                              {t('studentClassroom.viewAssignment')}
                            </Button>
                          </div>

                          <div className="w-full md:w-2 bg-gradient-to-b from-indigo-400 to-purple-500" />
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              ) : (
                finishedAssignments.length === 0 ? (
                  <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-200">
                        {t('studentClassroom.noFinishedAssignments')}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 max-w-md">
                        {t('studentClassroom.noFinishedAssignmentsDesc')}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {getSortedAssignments(finishedAssignments).map((assignment) => (
                      <Card
                        key={assignment.id}
                        className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-none shadow-md rounded-3xl bg-slate-50 dark:bg-slate-900/50 overflow-hidden opacity-80 hover:opacity-100"
                        onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                      >
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="secondary" className="rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {assignment.type.replace('_', ' ')}
                            </Badge>
                            <Badge className="rounded-full bg-green-100 text-green-700 hover:bg-green-200 border-none flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {t('common.completed')}
                            </Badge>
                          </div>

                          <h3 className="text-lg font-bold mb-2 text-slate-700 dark:text-slate-300">
                            {assignment.title}
                          </h3>

                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{t('common.due')}: {new Date(assignment.due_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </BreathingBackground>
  );
};

export default StudentClassroomDetail;
