import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, BookOpen, Bell, Sparkles, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  createNotification,
  getUnreadNotifications,
  type Notification,
} from '@/lib/notificationService';
import { StudentCalendar } from '@/components/StudentCalendar';
import { useTranslation } from 'react-i18next';
import { DashboardHeader } from '@/components/DashboardHeader';
import { BreathingBackground } from '@/components/ui/BreathingBackground';

interface Assignment {
  id: string;
  title: string;
  due_at: string;
  classrooms: {
    name: string;
    subject: string;
    teacher_id: string;
    teacher_profiles?: {
      full_name: string;
      avatar_url?: string;
    };
  };
}

interface Classroom {
  id: string;
  name: string;
  subject: string;
  start_date?: string | null;
  end_date?: string | null;
  classrooms: {
    invite_code: string;
  };
}

interface CalendarClassroom {
  id: string;
  name: string;
  subject: string;
  start_date: string | null;
  end_date: string | null;
}

interface CalendarAssignment {
  id: string;
  title: string;
  due_at: string;
  type: string;
  classrooms: {
    name: string;
    subject: string;
  };
}

const StudentDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [finishedAssignments, setFinishedAssignments] = useState<Assignment[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'due-date'>('due-date');
  const [assignmentsTab, setAssignmentsTab] = useState<'active' | 'finished'>('active');
  const [profile, setProfile] = useState<{ full_name: string; avatar_url?: string }>({
    full_name: '',
    avatar_url: '',
  });

  // Prevent refetching when tabbing in/out
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const lastUserIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // ProtectedRoute handles auth, just fetch data
    if (!user?.id) return;

    // Reset refs if user ID changes
    if (lastUserIdRef.current !== user.id) {
      hasFetchedRef.current = false;
      isFetchingRef.current = false;
      lastUserIdRef.current = user.id;
    }

    // Only fetch if we haven't fetched yet and not currently fetching
    if (!hasFetchedRef.current && !isFetchingRef.current) {
      fetchData();
    }
  }, [user?.id]); // Use user?.id to avoid refetch on user object reference change

  const fetchData = async () => {
    if (isFetchingRef.current) return; // Prevent concurrent fetches
    isFetchingRef.current = true;
    try {
      // Fetch student profile - use maybeSingle() to handle missing profiles
      const { data: profileData, error: profileError } = await supabase
        .from('student_profiles')
        .select('full_name, avatar_url')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!profileError && profileData) {
        setProfile(profileData);
      } else if (profileError) {
        console.error('Error fetching student profile:', profileError);
      }

      // Fetch enrollments and classrooms with date ranges
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('classroom_id, classrooms(id, name, subject, invite_code, start_date, end_date)')
        .eq('student_id', user?.id);

      if (enrollments && enrollments.length > 0) {
        const classroomIds = enrollments.map((e) => e.classroom_id);

        // Set classrooms list
        const classroomsList = enrollments.map((e) => ({
          id: e.classroom_id,
          name: e.classrooms.name,
          subject: e.classrooms.subject,
          start_date: e.classrooms.start_date,
          end_date: e.classrooms.end_date,
          classrooms: {
            invite_code: e.classrooms.invite_code,
          },
        }));
        setClassrooms(classroomsList);

        // Fetch assignments with teacher info
        const { data: assignmentsData } = await supabase
          .from('assignments')
          .select('*, classrooms(name, subject, teacher_id)')
          .in('classroom_id', classroomIds)
          .eq('status', 'published')
          .order('due_at', { ascending: true });

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

          // Fetch teacher profiles
          const teacherIds = [...new Set(assignmentsData.map((a) => a.classrooms.teacher_id))];
          const { data: teacherProfiles } = await supabase
            .from('teacher_profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', teacherIds);

          // Combine data and separate into active and finished
          const assignmentsWithTeachers = assignmentsData.map((assignment) => ({
            ...assignment,
            classrooms: {
              ...assignment.classrooms,
              teacher_profiles: teacherProfiles?.find(
                (t) => t.user_id === assignment.classrooms.teacher_id
              ),
            },
          }));

          // Separate active and finished assignments based on feedback existence
          const active = assignmentsWithTeachers.filter(a => !finishedAssignmentIds.has(a.id));
          const finished = assignmentsWithTeachers.filter(a => finishedAssignmentIds.has(a.id));

          setAssignments(active);
          setFinishedAssignments(finished);
        } else {
          setAssignments([]);
          setFinishedAssignments([]);
        }
      } else {
        setClassrooms([]);
        setAssignments([]);
        setFinishedAssignments([]);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error(t('studentDashboard.errors.loadingData'));
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      hasFetchedRef.current = true;
    }
  };

  const joinClassroom = async () => {
    if (!user || !inviteCode.trim()) {
      toast.error(t('studentDashboard.errors.enterInviteCode'));
      return;
    }

    setJoining(true);
    try {
      const trimmedCode = inviteCode.trim().toUpperCase();

      // Check if classroom exists - use a simpler query that bypasses RLS
      const { data: classroom, error: classroomError } = await supabase
        .from('classrooms')
        .select('id, name, invite_code')
        .eq('invite_code', trimmedCode)
        .maybeSingle();

      if (classroomError) {
        toast.error(t('studentDashboard.errors.checkingCode'));
        return;
      }

      if (!classroom) {
        toast.error(t('studentDashboard.errors.noClassroomFound', { code: trimmedCode }));
        return;
      }

      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('classroom_id', classroom.id)
        .eq('student_id', user.id)
        .maybeSingle();

      if (existingEnrollment) {
        toast.error(t('studentDashboard.errors.alreadyEnrolled'));
        setDialogOpen(false);
        return;
      }

      // Create enrollment
      const { error: enrollError } = await supabase.from('enrollments').insert({
        classroom_id: classroom.id,
        student_id: user.id,
      });

      if (enrollError) {
        toast.error(t('studentDashboard.errors.joiningClassroom'));
        return;
      }

      // Get student name for notification
      const { data: studentProfile } = await supabase
        .from('student_profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const studentName = studentProfile?.full_name || user.email || 'A student';

      // Notify the teacher about new enrollment
      try {
        const { data: classroomData } = await supabase
          .from('classrooms')
          .select('teacher_id')
          .eq('id', classroom.id)
          .single();

        if (classroomData?.teacher_id) {
          await createNotification(
            classroomData.teacher_id,
            'student_enrolled',
            'New Student Enrolled',
            `${studentName} joined ${classroom.name}`,
            `/teacher/classroom/${classroom.id}`,
            {
              classroom_id: classroom.id,
              student_id: user.id,
              student_name: studentName,
              classroom_name: classroom.name,
            }
          );
        }

        // Notify the student about successful enrollment
        await createNotification(
          user.id,
          'enrolled_in_classroom',
          'Successfully Enrolled',
          `You've joined ${classroom.name}`,
          `/student/classroom/${classroom.id}`,
          {
            classroom_id: classroom.id,
            classroom_name: classroom.name,
          }
        );
      } catch (notifError) { }

      toast.success(t('studentDashboard.success.joinedClassroom', { name: classroom.name }));
      setInviteCode('');
      setDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Error joining classroom:', error);
      toast.error(t('studentDashboard.errors.unexpected'));
    } finally {
      setJoining(false);
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

  const getInitials = () => {
    if (!profile.full_name) return 'S';
    const names = profile.full_name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0][0].toUpperCase();
  };

  // Transform data for calendar component
  const calendarClassrooms: CalendarClassroom[] = classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    start_date: c.start_date || null,
    end_date: c.end_date || null,
  }));

  const calendarAssignments: CalendarAssignment[] = assignments.map((a) => ({
    id: a.id,
    title: a.title,
    due_at: a.due_at,
    type: 'assignment', // Default type
    classrooms: {
      name: a.classrooms.name,
      subject: a.classrooms.subject || '',
    },
  }));

  return (
    <BreathingBackground className="min-h-screen">
      <DashboardHeader
        title={!loading && profile.full_name
          ? t('studentDashboard.welcome', { name: profile.full_name.split(' ')[0] })
          : t('studentDashboard.title')}
        userType="student"
      />

      <main className="container py-6 md:py-10 px-4 relative z-10">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* My Classes Section */}
            <section>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                    <BookOpen className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('studentDashboard.myClasses')}</h2>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="rounded-full shadow-md hover:shadow-lg transition-all bg-gradient-to-r from-indigo-500 to-purple-600 border-0">
                      <Plus className="me-2 h-4 w-4" />
                      {t('studentDashboard.joinClass')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle className="text-xl">{t('studentDashboard.joinClassroom.title')}</DialogTitle>
                      <DialogDescription>
                        {t('studentDashboard.joinClassroom.description')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="code" className="text-base font-medium">
                          {t('studentDashboard.joinClassroom.inviteCode')}
                        </Label>
                        <Input
                          id="code"
                          placeholder={t('studentDashboard.joinClassroom.placeholder')}
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          maxLength={6}
                          className="text-center text-2xl tracking-widest uppercase h-14 rounded-xl border-2 focus-visible:ring-indigo-500"
                        />
                      </div>
                      <Button
                        onClick={joinClassroom}
                        className="w-full rounded-full h-12 text-lg font-medium bg-indigo-600 hover:bg-indigo-700"
                        disabled={joining}
                      >
                        {joining
                          ? t('studentDashboard.joinClassroom.joining')
                          : t('studentDashboard.joinClassroom.button')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {loading ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-40 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                  ))}
                </div>
              ) : classrooms.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
                      <Sparkles className="h-8 w-8 text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2 text-slate-800 dark:text-slate-200">
                      {t('studentDashboard.empty.noClasses')}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                      {t('studentDashboard.empty.noClassesDescription')}
                    </p>
                    <Button onClick={() => setDialogOpen(true)} className="rounded-full">
                      <Plus className="me-2 h-4 w-4" />
                      {t('studentDashboard.joinClass')}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {classrooms.map((classroom, index) => {
                    // Generate deterministic gradient based on index
                    const gradients = [
                      'from-blue-400 to-indigo-500',
                      'from-purple-400 to-pink-500',
                      'from-emerald-400 to-teal-500',
                      'from-orange-400 to-amber-500',
                      'from-rose-400 to-red-500',
                      'from-cyan-400 to-blue-500',
                    ];
                    const gradient = gradients[index % gradients.length];

                    return (
                      <Card
                        key={classroom.id}
                        className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-none shadow-md rounded-3xl overflow-hidden bg-white dark:bg-slate-900 hover:-translate-y-1"
                        onClick={() => navigate(`/student/classroom/${classroom.id}`)}
                      >
                        <div className={`h-16 bg-gradient-to-r ${gradient} p-4 flex flex-col justify-between relative overflow-hidden`}>
                          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-xl" />
                          <div className="absolute bottom-0 left-0 w-16 h-16 bg-black/5 rounded-full -ml-4 -mb-4 blur-lg" />

                          <Badge className="self-start bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-sm">
                            {classroom.subject}
                          </Badge>
                        </div>
                        <CardContent className="p-5">
                          <h3 className="font-bold text-lg mb-1 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {classroom.name}
                          </h3>
                          <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 gap-2 mt-3">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{t('studentDashboard.activeCourse')}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Assignments Section */}
            <section>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                    <CalendarIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('studentDashboard.myAssignments')}</h2>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-800">
                  <Tabs value={assignmentsTab} onValueChange={(v) => setAssignmentsTab(v as 'active' | 'finished')} className="w-auto">
                    <TabsList className="h-9 bg-transparent p-0">
                      <TabsTrigger value="active" className="rounded-full px-4 text-slate-700 dark:text-slate-300 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900/50 dark:data-[state=active]:text-indigo-300">{t('common.active')}</TabsTrigger>
                      <TabsTrigger value="finished" className="rounded-full px-4 text-slate-700 dark:text-slate-300 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900/50 dark:data-[state=active]:text-indigo-300">{t('common.finished')}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              <div className="space-y-4">
                {!loading && (assignmentsTab === 'active' ? assignments.length > 0 : finishedAssignments.length > 0) && (
                  <div className="flex justify-end mb-2">
                    <Select
                      value={sortBy}
                      onValueChange={(value) => setSortBy(value as typeof sortBy)}
                    >
                      <SelectTrigger className="w-[180px] rounded-full border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <SelectValue placeholder={t('studentDashboard.sortBy')} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="due-date">{t('studentDashboard.sortOptions.dueDate')}</SelectItem>
                        <SelectItem value="recent">{t('studentDashboard.sortOptions.recent')}</SelectItem>
                        <SelectItem value="oldest">{t('studentDashboard.sortOptions.oldest')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    ))}
                  </div>
                ) : assignmentsTab === 'active' ? (
                  assignments.length === 0 ? (
                    <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="h-12 w-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
                          <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1">{t('studentDashboard.empty.noAssignments')}</h3>
                        <p className="text-sm text-muted-foreground">{t('studentDashboard.empty.noAssignmentsDescription')}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {getSortedAssignments().map((assignment) => {
                        const teacherInitials =
                          assignment.classrooms.teacher_profiles?.full_name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase() || 'T';

                        return (
                          <Card
                            key={assignment.id}
                            className="group hover:shadow-md transition-all duration-200 cursor-pointer border-none shadow-sm rounded-3xl bg-white dark:bg-slate-900 overflow-hidden"
                            onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center p-2">
                              <div className="p-4 flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="rounded-full border-indigo-200 text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">
                                    {assignment.classrooms.name}
                                  </Badge>
                                  <span className="text-xs text-slate-400">•</span>
                                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {t('common.due')}: {new Date(assignment.due_at).toLocaleDateString()}
                                  </span>
                                </div>
                                <h3 className="text-lg font-bold group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {assignment.title}
                                </h3>
                              </div>

                              <div className="flex items-center gap-3 px-4 pb-4 sm:pb-0 sm:border-s border-slate-100 dark:border-slate-800 sm:ps-6">
                                <div className="text-end hidden sm:block">
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.teacher')}</p>
                                  <p className="text-sm font-medium truncate max-w-[100px]">
                                    {assignment.classrooms.teacher_profiles?.full_name || t('common.teacher')}
                                  </p>
                                </div>
                                <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800 shadow-sm">
                                  {assignment.classrooms.teacher_profiles?.avatar_url && (
                                    <AvatarImage
                                      src={assignment.classrooms.teacher_profiles.avatar_url}
                                      alt={assignment.classrooms.teacher_profiles.full_name || t('common.teacher')}
                                    />
                                  )}
                                  <AvatarFallback className="bg-indigo-100 text-indigo-600">{teacherInitials}</AvatarFallback>
                                </Avatar>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )
                ) : (
                  // Finished assignments tab
                  finishedAssignments.length === 0 ? (
                    <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-3xl">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="h-12 w-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                          <BookOpen className="h-6 w-6 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1">{t('studentDashboard.noFinishedAssignments')}</h3>
                        <p className="text-sm text-muted-foreground">{t('studentDashboard.noFinishedAssignmentsDesc')}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {getSortedAssignments(finishedAssignments).map((assignment) => {
                        const teacherInitials =
                          assignment.classrooms.teacher_profiles?.full_name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase() || 'T';

                        return (
                          <Card
                            key={assignment.id}
                            className="group hover:shadow-md transition-all duration-200 cursor-pointer border-none shadow-sm rounded-3xl bg-slate-50 dark:bg-slate-900/50 overflow-hidden opacity-80 hover:opacity-100"
                            onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center p-2">
                              <div className="p-4 flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="secondary" className="rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {assignment.classrooms.name}
                                  </Badge>
                                  <Badge className="rounded-full bg-green-100 text-green-700 hover:bg-green-200 border-none">
                                    {t('common.completed')}
                                  </Badge>
                                </div>
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                                  {assignment.title}
                                </h3>
                              </div>

                              <div className="flex items-center gap-3 px-4 pb-4 sm:pb-0 sm:border-s border-slate-200 dark:border-slate-800 sm:ps-6">
                                <Avatar className="h-8 w-8 grayscale opacity-70">
                                  {assignment.classrooms.teacher_profiles?.avatar_url && (
                                    <AvatarImage
                                      src={assignment.classrooms.teacher_profiles.avatar_url}
                                      alt={assignment.classrooms.teacher_profiles.full_name || t('common.teacher')}
                                    />
                                  )}
                                  <AvatarFallback>{teacherInitials}</AvatarFallback>
                                </Avatar>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </section>
          </div>

          {/* Calendar Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {user && (
                <StudentCalendar
                  studentId={user.id}
                  assignments={calendarAssignments}
                  classrooms={calendarClassrooms}
                  loading={loading}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </BreathingBackground>
  );
};

export default StudentDashboard;
