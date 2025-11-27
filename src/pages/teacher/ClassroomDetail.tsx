import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { DashboardHeader } from '@/components/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ArrowLeft,
  Users,
  BookOpen,
  Calendar,
  Plus,
  Edit,
  BarChart3,
  Trash2,
  FileText,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { EditClassroomDialog } from '@/components/EditClassroomDialog';
import { CreateAssignmentDialog } from '@/components/CreateAssignmentDialog';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog';
import { ClassroomAnalytics } from '@/components/ClassroomAnalytics';
import { SubmissionsTab } from '@/components/SubmissionsTab';
import { RegenerateScoresButton } from '@/components/RegenerateScoresButton';
import { BreathingBackground } from '@/components/ui/BreathingBackground';

interface CourseMaterial {
  type: 'pdf' | 'link';
  url: string;
  name: string;
}

interface Domain {
  name: string;
  components: string[];
}

interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  course_title: string;
  course_duration: string;
  start_date: string;
  end_date: string;
  course_outline: string;
  resources: string;
  learning_outcomes: string[] | null;
  key_challenges: string[] | null;
  domains: Domain[] | null;
  materials: CourseMaterial[] | null;
}

interface Assignment {
  id: string;
  title: string;
  instructions: string;
  type: string;
  status: string;
  due_at: string;
  materials?: string;
  assigned_student_id: string | null;
  student_profiles?: {
    full_name: string;
  } | null;
}

interface EnrolledStudent {
  id: string;
  created_at: string;
  student_id: string;
  student_profiles: {
    full_name: string;
    avatar_url?: string;
    user_id: string;
  } | null;
}

const ClassroomDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editAssignmentDialogOpen, setEditAssignmentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<number>>(new Set());

  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastIdRef = useRef(id);

  useEffect(() => {
    // ProtectedRoute handles auth, just fetch data when user is available
    if (!user?.id) return;

    // Reset refs if classroom ID changes
    if (lastIdRef.current !== id) {
      hasFetchedRef.current = false;
      isFetchingRef.current = false;
      lastIdRef.current = id;
    }

    // Only fetch if we haven't fetched yet and not currently fetching
    if (!hasFetchedRef.current && !isFetchingRef.current) {
      fetchClassroom();
    }
  }, [id, user?.id]); // Use user?.id instead of user to avoid refetch on user object reference change

  const fetchClassroom = async () => {
    isFetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('classrooms')
        .select('*')
        .eq('id', id)
        .eq('teacher_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error(t('classroomDetail.errors.loading'));
        navigate('/teacher/dashboard');
        return;
      }

      // Safely cast JSON fields
      const learning_outcomes = Array.isArray(data.learning_outcomes)
        ? data.learning_outcomes.map(String)
        : null;

      const key_challenges = Array.isArray(data.key_challenges)
        ? data.key_challenges.map(String)
        : null;

      // Cast domains and materials if they exist in the data
      const domains = (data as any).domains as Domain[] | null;
      const materials = (data as any).materials as CourseMaterial[] | null;

      setClassroom({
        ...data,
        learning_outcomes,
        key_challenges,
        domains: domains || null,
        materials: materials || null,
      });
      await fetchAssignments();
      await fetchStudents();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t('classroomDetail.errors.loading');
      console.error('Error loading classroom:', errorMessage);
      toast.error(t('classroomDetail.errors.loading'));
      navigate('/teacher/dashboard');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data: assignmentsData, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('classroom_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch student profiles for assigned students
      const assignedStudentIds =
        assignmentsData?.filter((a) => a.assigned_student_id).map((a) => a.assigned_student_id) ||
        [];

      let studentProfilesMap: Record<string, { full_name: string }> = {};

      if (assignedStudentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('student_profiles')
          .select('user_id, full_name')
          .in('user_id', assignedStudentIds);

        if (profiles) {
          studentProfilesMap = profiles.reduce(
            (acc, profile) => {
              acc[profile.user_id] = { full_name: profile.full_name };
              return acc;
            },
            {} as Record<string, { full_name: string }>
          );
        }
      }

      // Combine data
      const assignmentsWithProfiles =
        assignmentsData?.map((assignment) => ({
          ...assignment,
          student_profiles: assignment.assigned_student_id
            ? studentProfilesMap[assignment.assigned_student_id] || null
            : null,
        })) || [];

      setAssignments(assignmentsWithProfiles);
    } catch (error) {
      // Silent fail - assignments will be empty
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data: enrollments, error } = await supabase
        .from('enrollments')
        .select('id, created_at, student_id')
        .eq('classroom_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!enrollments || enrollments.length === 0) {
        setStudents([]);
        return;
      }

      // Fetch student profiles separately
      const studentIds = enrollments.map((e) => e.student_id);
      const { data: profiles, error: profileError } = await supabase
        .from('student_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', studentIds);

      // Continue even if some profiles fail to load

      // Combine the data
      const studentsWithProfiles = enrollments.map((enrollment) => ({
        id: enrollment.id,
        created_at: enrollment.created_at,
        student_id: enrollment.student_id,
        student_profiles: profiles?.find((p) => p.user_id === enrollment.student_id) || null,
      }));

      setStudents(studentsWithProfiles);
    } catch (error) {
      // Silent fail - students will be empty
      console.error('Error fetching students:', error);
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;

    try {
      const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);

      if (error) throw error;
      toast.success(t('classroomDetail.success.assignmentDeleted'));
      fetchAssignments();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast.error(t('classroomDetail.errors.deleting'));
    }
  };

  const deleteClassroom = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('classrooms')
        .delete()
        .eq('id', id)
        .eq('teacher_id', user?.id);

      if (error) throw error;

      toast.success(t('classroomDetail.success.deleted'));
      navigate('/teacher/dashboard');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t('classroomDetail.errors.deleting');
      console.error('Error deleting classroom:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const toggleDomain = (index: number) => {
    setExpandedDomains(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!classroom) return null;

  return (
    <BreathingBackground className="min-h-screen pb-12">
      <DashboardHeader
        title={classroom.name}
        subtitle={classroom.subject}
        userType="teacher"
        showBackButton
        onBackClick={() => navigate('/teacher/dashboard')}
      />

      <main className="container py-6 md:py-8 px-4 max-w-7xl mx-auto">
        <Tabs defaultValue="overview" className="space-y-6 md:space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
          <TabsList className={`bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-full inline-flex h-auto w-full sm:w-auto overflow-x-auto justify-start`}>
            <TabsTrigger
              value="overview"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
            >
              {t('studentClassroom.about')}
            </TabsTrigger>
            <TabsTrigger
              value="assignments"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
            >
              {t('studentClassroom.assignments')}
            </TabsTrigger>
            <TabsTrigger
              value="students"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
            >
              {t('classroomDetail.students')}
            </TabsTrigger>
            <TabsTrigger
              value="submissions"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
            >
              {t('classroomDetail.submissionsTab')}
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
            >
              {t('classroomDetail.analytics')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRTL ? '' : ''}`}>
              <div className={`flex flex-col sm:flex-row gap-3 w-full sm:w-auto ${isRTL ? 'sm:order-2' : 'sm:order-1'}`}>
                <Button
                  onClick={() => setEditDialogOpen(true)}
                  size="sm"
                  className="w-full sm:w-auto rounded-full shadow-sm hover:shadow-md transition-all"
                  variant="outline"
                >
                  <Edit className="me-2 h-4 w-4" />
                  {t('classroomDetail.edit')}
                </Button>
                <Button
                  onClick={() => setDeleteDialogOpen(true)}
                  size="sm"
                  variant="destructive"
                  className="w-full sm:w-auto rounded-full shadow-sm hover:shadow-md transition-all"
                >
                  <Trash2 className="me-2 h-4 w-4" />
                  {t('classroomDetail.deleteButton')}
                </Button>
              </div>
              <h2 className={`text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 ${isRTL ? 'text-right sm:order-1' : 'text-left sm:order-2'}`}>
                {t('classroomDetail.overview.title')}
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Invite Code Card */}
              <Card className="md:col-span-2 lg:col-span-3 rounded-3xl border-none shadow-sm bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-900/20 dark:to-pink-900/20 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-slate-800 dark:text-slate-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('classroomDetail.inviteCode')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 justify-start">
                    <div className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/50 dark:border-white/10 shadow-sm">
                      <code className="text-3xl font-mono font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                        {classroom.invite_code}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50"
                      onClick={() => {
                        navigator.clipboard.writeText(classroom.invite_code);
                        toast.success(t('classroomDetail.copiedToClipboard'));
                      }}
                    >
                      <LinkIcon className="h-5 w-5 text-slate-500" />
                    </Button>
                  </div>
                  <p className={`text-sm text-slate-600 dark:text-slate-400 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('classroomDetail.shareCode')}
                  </p>
                </CardContent>
              </Card>

              {/* Course Info */}
              {classroom.course_title && (
                <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800" dir={isRTL ? 'rtl' : 'ltr'}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      {t('classroomDetail.overview.courseInfo')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <h3 className={`text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t('classroomDetail.overview.courseTitle')}
                      </h3>
                      <p className={`font-medium text-slate-800 dark:text-slate-200 ${isRTL ? 'text-right' : 'text-left'}`}>{classroom.course_title}</p>
                    </div>

                    {classroom.course_duration && (
                      <div>
                        <h3 className={`text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('classroomDetail.overview.duration')}
                        </h3>
                        <p className={`font-medium text-slate-800 dark:text-slate-200 ${isRTL ? 'text-right' : 'text-left'}`}>{classroom.course_duration}</p>
                      </div>
                    )}

                    {(classroom.start_date || classroom.end_date) && (
                      <div>
                        <h3 className={`text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('classroomDetail.overview.courseDates')}
                        </h3>
                        <div className={`text-slate-700 dark:text-slate-300 space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {classroom.start_date && (
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span className="text-sm">{t('common.start')}: {new Date(classroom.start_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {classroom.end_date && (
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              <span className="text-sm">{t('common.end')}: {new Date(classroom.end_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Outline & Resources */}
              {(classroom.course_outline || classroom.resources) && (
                <Card className="md:col-span-2 lg:col-span-2 rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800" dir={isRTL ? 'rtl' : 'ltr'}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                        <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      {t('classroomDetail.details')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {classroom.course_outline && (
                      <div>
                        <h3 className={`text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('classroomDetail.overview.courseOutline')}
                        </h3>
                        <p className={`text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl ${isRTL ? 'text-right' : 'text-left'}`}>
                          {classroom.course_outline}
                        </p>
                      </div>
                    )}

                    {classroom.resources && (
                      <div>
                        <h3 className={`text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {t('classroomDetail.overview.resources')}
                        </h3>
                        <p className={`text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl ${isRTL ? 'text-right' : 'text-left'}`}>
                          {classroom.resources}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Learning Outcomes & Challenges */}
              {(classroom.learning_outcomes?.length || classroom.key_challenges?.length) ? (
                <Card className="md:col-span-2 lg:col-span-3 rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800" dir={isRTL ? 'rtl' : 'ltr'}>
                  <CardContent className="p-6 grid md:grid-cols-2 gap-8">
                    {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
                      <div>
                        <h3 className={`flex items-center gap-2 font-bold text-lg mb-4 text-slate-800 dark:text-slate-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                            <BarChart3 className="h-4 w-4" />
                          </span>
                          {t('classroomDetail.overview.learningOutcomes')}
                        </h3>
                        <ul className="space-y-3">
                          {classroom.learning_outcomes.map((outcome: string, index: number) => (
                            <li key={index} className={`flex items-start gap-3 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}>
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold mt-0.5">
                                {index + 1}
                              </span>
                              <span className="text-sm leading-relaxed">{outcome}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                      <div>
                        <h3 className={`flex items-center gap-2 font-bold text-lg mb-4 text-slate-800 dark:text-slate-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400">
                            <Users className="h-4 w-4" />
                          </span>
                          {t('classroomDetail.overview.keyChallenges')}
                        </h3>
                        <ul className="space-y-3">
                          {classroom.key_challenges.map((challenge: string, index: number) => (
                            <li key={index} className={`flex items-start gap-3 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl ${isRTL ? 'text-right' : 'text-left'}`}>
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center text-xs font-bold mt-0.5">
                                !
                              </span>
                              <span className="text-sm leading-relaxed">{challenge}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </div>

            {/* Domains & Components Section */}
            {classroom.domains && classroom.domains.length > 0 && (
              <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800" dir={isRTL ? 'rtl' : 'ltr'}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl">
                      <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    {t('classroomDetail.subjectAreas')}
                  </CardTitle>
                  <CardDescription className={isRTL ? 'text-right' : 'text-left'}>{t('classroomDetail.subjectAreasDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {classroom.domains.map((domain, index) => (
                    <div key={index} className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900/30"
                        onClick={() => toggleDomain(index)}
                      >
                        <span className={`font-semibold text-slate-800 dark:text-slate-200 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {domain.name}
                        </span>
                        {expandedDomains.has(index) ? (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        )}
                      </button>
                      {expandedDomains.has(index) && (
                        <div className="px-4 pb-4 pt-2 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                          <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('classroomDetail.skills')}</p>
                          <div className={`flex flex-wrap gap-2 ${isRTL ? 'justify-end' : 'justify-start'}`}>
                            {domain.components.map((component, compIndex) => (
                              <Badge key={compIndex} variant="secondary" className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 font-normal">
                                {component}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Course Materials Section */}
            {classroom.materials && classroom.materials.length > 0 && (
              <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                      <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    {t('classroomDetail.courseMaterials')}
                  </CardTitle>
                  <CardDescription className={isRTL ? 'text-right' : 'text-left'}>{t('classroomDetail.courseMaterialsDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {classroom.materials.map((material, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="justify-start h-auto py-4 px-4 rounded-2xl border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                        onClick={() => window.open(material.url, '_blank')}
                      >
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl me-3 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                          {material.type === 'pdf' ? (
                            <FileText className="h-5 w-5 text-slate-500 group-hover:text-primary transition-colors" />
                          ) : (
                            <LinkIcon className="h-5 w-5 text-slate-500 group-hover:text-primary transition-colors" />
                          )}
                        </div>
                        <div className={`flex-1 overflow-hidden ${isRTL ? 'text-right' : 'text-left'}`}>
                          <span className="block font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-primary transition-colors">{material.name}</span>
                          <span className="text-xs text-slate-400 capitalize">{material.type}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6 animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isRTL ? '' : ''}`}>
              <Button
                onClick={() => setAssignmentDialogOpen(true)}
                className={`w-full sm:w-auto rounded-full shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90 ${isRTL ? 'sm:order-2' : 'sm:order-1'}`}
              >
                <Plus className="me-2 h-4 w-4" />
                {t('classroomDetail.createAssignment')}
              </Button>
              <div className={`${isRTL ? 'text-right sm:order-1' : 'text-left sm:order-2'}`}>
                <h2 className={`text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomDetail.assignments')}
                </h2>
                <p className={`text-slate-500 dark:text-slate-400 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomDetail.assignmentsSubtitle')}
                </p>
              </div>
            </div>

            {assignments.length === 0 ? (
              <Card className="rounded-3xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                    <BookOpen className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    {t('classroomDetail.noAssignments')}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
                    {t('classroomDetail.noAssignmentsDesc')}
                  </p>
                  <Button onClick={() => setAssignmentDialogOpen(true)} className="rounded-full">
                    <Plus className="me-2 h-4 w-4" />
                    {t('classroomDetail.createAssignment')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {assignments.map((assignment) => (
                  <Card key={assignment.id} className="group rounded-3xl border-none shadow-sm hover:shadow-md transition-all bg-white dark:bg-slate-900 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <CardTitle className={`text-lg font-bold text-slate-800 dark:text-slate-100 truncate ${isRTL ? 'text-right' : 'text-left'}`}>
                              {assignment.title}
                            </CardTitle>
                            {assignment.assigned_student_id && (
                              <Badge
                                variant="outline"
                                className="rounded-full bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
                              >
                                {t('classroomDetail.assignedTo')} {assignment.student_profiles?.full_name || 'Student'}
                              </Badge>
                            )}
                            <Badge
                              variant={assignment.status === 'published' ? 'default' : 'secondary'}
                              className={`rounded-full px-3 font-normal ${assignment.status === 'published'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                            >
                              {assignment.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                              {t('classroomDetail.type')} {assignment.type.replace('_', ' ')}
                            </span>
                            {assignment.due_at && (
                              <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                {t('classroomDetail.due')} {new Date(assignment.due_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setEditAssignmentDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600"
                            onClick={() => deleteAssignment(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-slate-500 hover:text-rose-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className={`text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl ${isRTL ? 'text-right' : 'text-left'}`}>
                        {assignment.instructions}
                      </p>

                      {/* Course Materials */}
                      {assignment.materials &&
                        (() => {
                          try {
                            const materials: CourseMaterial[] = typeof assignment.materials === 'string'
                              ? JSON.parse(assignment.materials)
                              : assignment.materials;
                            if (Array.isArray(materials) && materials.length > 0) {
                              return (
                                <div className="pt-2">
                                  <p className={`text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                                    {t('classroomDetail.attachments')} ({materials.length})
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {materials.map((material, index) => (
                                      <Button
                                        key={index}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(material.url, '_blank')}
                                        className="gap-2 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                      >
                                        {material.type === 'pdf' ? (
                                          <FileText className="h-3.5 w-3.5 text-rose-500" />
                                        ) : (
                                          <LinkIcon className="h-3.5 w-3.5 text-blue-500" />
                                        )}
                                        <span className="text-xs font-medium">{material.name}</span>
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          } catch (e) {
                            // Ignore parsing errors
                          }
                          return null;
                        })()}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="students" className="space-y-6 animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            <div>
              <h2 className={`text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('classroomDetail.studentsTab.title')}
              </h2>
              <p className={`text-slate-500 dark:text-slate-400 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('classroomDetail.studentsTab.subtitle')}
              </p>
            </div>

            <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                    <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  {t('common.students')} ({students.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                      <Users className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">{t('classroomDetail.studentsTab.noStudents')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {students.map((enrollment) => {
                      const hasName = enrollment.student_profiles?.full_name;
                      const displayName = hasName
                        ? enrollment.student_profiles.full_name
                        : t('classroomDetail.studentsTab.studentIncomplete');
                      const initials = hasName
                        ? enrollment.student_profiles.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                        : 'S';

                      return (
                        <div
                          key={enrollment.id}
                          className="flex items-center gap-4 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900/30"
                        >
                          <Avatar className="h-12 w-12 border-2 border-white dark:border-slate-800 shadow-sm">
                            {enrollment.student_profiles?.avatar_url && (
                              <AvatarImage
                                src={enrollment.student_profiles.avatar_url}
                                alt={displayName}
                              />
                            )}
                            <AvatarFallback className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">{initials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-bold text-slate-800 dark:text-slate-200 truncate ${!hasName ? 'text-slate-400 italic' : ''}`}
                            >
                              {displayName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="h-3 w-3" />
                              {t('classroomDetail.studentsTab.joined')}:{' '}
                              {new Date(enrollment.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6 animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            <div>
              <h2 className={`text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('classroomDetail.submissions.title')}
              </h2>
              <p className={`text-slate-500 dark:text-slate-400 mt-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('classroomDetail.submissions.subtitle')}
              </p>
            </div>
            <SubmissionsTab classroomId={id!} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 animate-in fade-in-50 duration-500 slide-in-from-bottom-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className={`text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {t('classroomDetail.analytics')}
                </h2>
              </div>
              <RegenerateScoresButton classroomId={id!} onComplete={fetchClassroom} />
            </div>
            <ClassroomAnalytics classroomId={id!} />
          </TabsContent>
        </Tabs>
      </main>

      <EditClassroomDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        classroom={classroom!}
        onSuccess={fetchClassroom}
      />

      <CreateAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        classroomId={id!}
        onSuccess={fetchAssignments}
      />

      {selectedAssignment && (
        <EditAssignmentDialog
          open={editAssignmentDialogOpen}
          onOpenChange={setEditAssignmentDialogOpen}
          assignment={selectedAssignment}
          onSuccess={fetchAssignments}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('classroomDetail.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{t('classroomDetail.deleteDialog.description')}</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    <strong>{assignments.length}</strong> {assignments.length !== 1 ? t('classroomDetail.deleteDialog.assignmentCountPlural') : t('classroomDetail.deleteDialog.assignmentCount')}
                  </li>
                  <li>
                    <strong>{students.length}</strong> {students.length !== 1 ? t('classroomDetail.deleteDialog.studentCountPlural') : t('classroomDetail.deleteDialog.studentCount')}
                  </li>
                  <li>{t('classroomDetail.deleteDialog.allSubmissions')}</li>
                  <li>{t('classroomDetail.deleteDialog.allAnalytics')}</li>
                </ul>
                <p className="font-semibold text-destructive mt-4">{t('classroomDetail.deleteDialog.classroomLabel')} {classroom?.name}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-full">{t('classroomDetail.deleteDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteClassroom}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
            >
              {isDeleting ? t('classroomDetail.deleteDialog.deleting') : t('classroomDetail.deleteDialog.deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog >
    </BreathingBackground >
  );
};

export default ClassroomDetail;
