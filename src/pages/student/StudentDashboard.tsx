import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Plus, BookOpen, Sparkles, Clock, LayoutGrid, List, Grid2x2, LayoutList, Table2, CalendarDays, Calendar } from 'lucide-react';
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
} from '@/lib/notificationService';
import { StudentCalendar } from '@/components/StudentCalendar';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { SkeletonCardGrid, SkeletonRowList } from '@/components/ui/GsapSkeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useClassrooms, useStudentAssignments, useJoinClassroom } from '@/hooks/queries';
import { ClassroomTableView } from '@/components/features/dashboard/ClassroomTableView';
import { ClassroomTimelineView } from '@/components/features/dashboard/ClassroomTimelineView';
import { copyToClipboard } from '@/lib/utils';

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
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: rawClassrooms = [], isLoading: classroomsLoading, refetch: refetchClassrooms } = useClassrooms('student');
  const { data: rawAssignments = [], isLoading: assignmentsLoading, refetch: refetchAssignments } = useStudentAssignments();
  const joinClassroomMutation = useJoinClassroom();

  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact' | 'detailed' | 'table' | 'timeline'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'due-date'>('due-date');
  const [assignmentsTab, setAssignmentsTab] = useState<'active' | 'finished'>('active');
  const [teacherProfiles, setTeacherProfiles] = useState<Record<string, { full_name: string; avatar_url?: string }>>({});

  // Fetch teacher profiles when classrooms or assignments change
  useEffect(() => {
    const fetchTeacherProfiles = async () => {
      const teacherIds = new Set<string>();
      rawClassrooms.forEach((c: any) => { if (c.teacher_id) teacherIds.add(c.teacher_id); });
      rawAssignments.forEach((a: any) => { if (a.classrooms?.teacher_id) teacherIds.add(a.classrooms.teacher_id); });

      if (teacherIds.size === 0) return;

      const { data, error } = await supabase
        .from('teacher_profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', Array.from(teacherIds));

      if (error) {
        console.error('Error fetching teacher profiles:', error);
        return;
      }

      if (data) {
        const profilesMap: Record<string, { full_name: string; avatar_url?: string }> = {};
        data.forEach(p => {
          profilesMap[p.user_id] = {
            full_name: p.full_name || '',
            avatar_url: p.avatar_url || undefined
          };
        });
        setTeacherProfiles(profilesMap);
      }
    };

    if (!classroomsLoading && !assignmentsLoading) {
      fetchTeacherProfiles();
    }
  }, [rawClassrooms, rawAssignments, classroomsLoading, assignmentsLoading]);

  // Transform and memoize classrooms data
  const classrooms: Classroom[] = useMemo(() => rawClassrooms.map((c: any) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    start_date: c.start_date,
    end_date: c.end_date,
    classrooms: {
      invite_code: c.invite_code
    },
    teacher_profiles: teacherProfiles[c.teacher_id] || null
  })), [rawClassrooms, teacherProfiles]);

  // Separate assignments and memoize
  const allAssignments = useMemo(() => (rawAssignments as any[]).map(a => ({
    ...a,
    classrooms: {
      ...a.classrooms,
      teacher_profiles: teacherProfiles[a.classrooms?.teacher_id] || null
    },
    is_completed: a.submissions?.some((s: any) => 
      s.status === 'completed' || 
      (s.assignment_feedback && s.assignment_feedback.length > 0)
    ) || false
  })) as unknown as Assignment[], [rawAssignments, teacherProfiles]);
  const assignments = useMemo(() => allAssignments.filter((a: any) => !a.is_completed), [allAssignments]);
  const finishedAssignments = useMemo(() => allAssignments.filter((a: any) => a.is_completed), [allAssignments]);

  // Memoize calendar data
  const calendarClassrooms: CalendarClassroom[] = useMemo(() => classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    start_date: c.start_date || null,
    end_date: c.end_date || null,
  })), [classrooms]);

  const calendarAssignments: CalendarAssignment[] = useMemo(() => allAssignments.map((a) => ({
    id: a.id,
    title: a.title,
    due_at: a.due_at,
    type: 'assignment',
    classrooms: {
      name: a.classrooms.name,
      subject: a.classrooms.subject,
    }
  })), [allAssignments]);

  const loading = classroomsLoading || assignmentsLoading;

  // GSAP stagger animation refs - only trigger on data changes
  const classroomsRef = useStaggerAnimation(':scope > div', 0.08, [classrooms.length, viewMode]);
  const assignmentsRef = useStaggerAnimation(':scope > div', 0.06, [assignments.length, assignmentsTab]);

  const handleCopyInviteCode = async (e: React.MouseEvent, inviteCode: string) => {
    e.stopPropagation();
    try {
      await copyToClipboard(inviteCode);
      toast.success(t('teacherDashboard.inviteCodeCopied') || 'Invite code copied!');
    } catch (error) {
      toast.error(t('common.error') || 'Failed to copy');
    }
  };

  const formatDate = (dateString: string | null | undefined, format: 'short' | 'long' = 'short') => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (format === 'short') {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getViewModeLabel = (mode: typeof viewMode) => {
    const labels = {
      grid: 'Grid',
      compact: 'Compact',
      list: 'List',
      detailed: 'Detailed',
      table: 'Table',
      timeline: 'Timeline',
    };
    return labels[mode];
  };

  const handleJoinClassroom = async () => {
    if (!user || !inviteCode.trim()) {
      toast.error(t('studentDashboard.errors.enterInviteCode'));
      return;
    }

    setJoining(true);
    try {
      const trimmedCode = inviteCode.trim().toUpperCase();

      // Find classroom by invite code
      const { data: classroom, error: findError } = await supabase
        .from('classrooms')
        .select('id, name, teacher_id')
        .eq('invite_code', trimmedCode)
        .maybeSingle();

      if (findError || !classroom) {
        toast.error(t('studentDashboard.errors.noClassroomFound', { code: trimmedCode }));
        return;
      }

      await joinClassroomMutation.mutateAsync({
        classroomId: classroom.id,
        studentId: user.id
      });

      // Notify teacher and student
      try {
        const studentName = profile?.full_name || user.email || 'A student';
        await createNotification(
          classroom.teacher_id,
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
      } catch (e) { }

      toast.success(t('studentDashboard.success.joinedClassroom', { name: classroom.name }));
      setInviteCode('');
      setDialogOpen(false);
      refetchClassrooms();
      refetchAssignments();
    } catch (error: any) {
      toast.error(error.message || t('studentDashboard.errors.unexpected'));
    } finally {
      setJoining(false);
    }
  };

  const getSortedAssignments = (assignmentsList: Assignment[] = assignments) => {
    const sorted = [...assignmentsList];
    switch (sortBy) {
      case 'recent':
        return sorted.reverse();
      case 'oldest':
        return sorted;
      case 'due-date':
        return sorted.sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
      default:
        return sorted;
    }
  };

  return (
    <DashboardLayout breadcrumbs={[{ label: t('nav.dashboard') }]}>
      {/* Page Header */}
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('studentDashboard.title')}</h1>
        <p className="text-muted-foreground">{t('studentDashboard.subtitle')}</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-8">
          {/* My Classes Section */}
          <section>
            <div className="flex flex-col gap-6 mb-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-foreground">{t('studentDashboard.myClasses')}</h2>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* View Switcher */}
                {classrooms.length > 0 && (
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground mr-2">View:</span>
                    <Select value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)}>
                      <SelectTrigger className="w-[180px] bg-card">
                        <SelectValue>
                          <span>{getViewModeLabel(viewMode)}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-card">
                        <SelectItem value="grid">
                          <div className="flex items-center gap-2">
                            <LayoutGrid className="h-4 w-4" />
                            <span>Grid</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="compact">
                          <div className="flex items-center gap-2">
                            <Grid2x2 className="h-4 w-4" />
                            <span>Compact</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="list">
                          <div className="flex items-center gap-2">
                            <List className="h-4 w-4" />
                            <span>List</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="detailed">
                          <div className="flex items-center gap-2">
                            <LayoutList className="h-4 w-4" />
                            <span>Detailed</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="table">
                          <div className="flex items-center gap-2">
                            <Table2 className="h-4 w-4" />
                            <span>Table</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="timeline">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            <span>Timeline</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="gap-2 w-full sm:w-auto">
                      <Plus className="h-4 w-4" />
                      {t('studentDashboard.joinClass')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-xl sm:max-w-[425px] bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-xl text-foreground">{t('studentDashboard.joinClassroom.title')}</DialogTitle>
                      <DialogDescription>
                        {t('studentDashboard.joinClassroom.description')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="code" className="text-base font-medium text-foreground">
                          {t('studentDashboard.joinClassroom.inviteCode')}
                        </Label>
                        <Input
                          id="code"
                          placeholder={t('studentDashboard.joinClassroom.placeholder')}
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          maxLength={6}
                          className="text-center text-2xl tracking-widest uppercase h-14 rounded-xl border-2 focus-visible:ring-ring bg-card text-foreground"
                        />
                      </div>
                      <Button
                        onClick={handleJoinClassroom}
                        className="w-full rounded-full h-12 text-lg font-medium"
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
            </div>

            {loading ? (
              <SkeletonCardGrid count={3} className="sm:grid-cols-2 lg:grid-cols-3 gap-4" />
            ) : classrooms.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={t('studentDashboard.empty.noClasses')}
                description={t('studentDashboard.empty.noClassesDescription')}
                action={{
                  label: t('studentDashboard.joinClass'),
                  onClick: () => setDialogOpen(true),
                }}
              />
            ) : viewMode === 'table' ? (
              <ClassroomTableView
                classrooms={classrooms.map(c => ({ ...c, invite_code: c.classrooms.invite_code }))}
                onCopyInviteCode={(code) => console.log('Copied:', code)}
              />
            ) : viewMode === 'timeline' ? (
              <ClassroomTimelineView
                classrooms={classrooms.map(c => ({ ...c, invite_code: c.classrooms.invite_code }))}
                onCopyInviteCode={(code) => console.log('Copied:', code)}
              />
            ) : (
              <div
                ref={classroomsRef}
                className={
                  viewMode === 'grid' ? 'grid gap-4' :
                    viewMode === 'compact' ? 'grid gap-3' :
                      viewMode === 'list' ? 'flex flex-col gap-4' :
                        'grid gap-5'
                }
                style={
                  viewMode === 'grid' ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' } :
                    viewMode === 'compact' ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))' } :
                      viewMode === 'detailed' ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(350px, 100%), 1fr))' } :
                        undefined
                }
              >
                {classrooms.map((classroom) => (
                  // Grid View
                  viewMode === 'grid' ? (
                    <Card
                      key={classroom.id}
                      className="group relative overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-200 active:scale-[0.98] bg-card border-border"
                      onClick={() => navigate(`/student/classroom/${classroom.id}`)}
                    >
                      <CardContent className="p-4 relative">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base mb-2 truncate group-hover:text-primary transition-colors text-foreground">
                              {classroom.name}
                            </h3>
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">
                              {classroom.subject}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-2 pt-3 border-t border-border">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5 mr-1.5" />
                              <span>{t('studentDashboard.activeCourse')}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>{formatDate(classroom.start_date)}</span>
                            </div>
                          </div>

                          {classroom.teacher_profiles && (
                            <div className="flex items-center gap-2 pt-1">
                              <Avatar className="h-6 w-6 border border-background">
                                {classroom.teacher_profiles.avatar_url && (
                                  <AvatarImage src={classroom.teacher_profiles.avatar_url} />
                                )}
                                <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                                  {(classroom.teacher_profiles.full_name || 'T').charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                                {classroom.teacher_profiles.full_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : viewMode === 'compact' ? (
                    // Compact View
                    <Card
                      key={classroom.id}
                      className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
                      onClick={() => navigate(`/student/classroom/${classroom.id}`)}
                    >
                      <CardContent className="p-3">
                        <div className="mb-2">
                          <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors text-foreground">
                            {classroom.name}
                          </h3>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Active</span>
                            <span className="mx-1">•</span>
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(classroom.start_date)}</span>
                          </div>
                          {classroom.teacher_profiles && (
                            <div className="flex items-center gap-1.5 pt-1">
                              <Avatar className="h-4 w-4">
                                {classroom.teacher_profiles.avatar_url && (
                                  <AvatarImage src={classroom.teacher_profiles.avatar_url} />
                                )}
                                <AvatarFallback className="text-[8px] bg-primary/5 text-primary">
                                  {(classroom.teacher_profiles.full_name || 'T').charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-[10px] text-muted-foreground truncate">
                                {classroom.teacher_profiles.full_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ) : viewMode === 'list' ? (
                    // List View
                    <Card
                      key={classroom.id}
                      className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
                      onClick={() => navigate(`/student/classroom/${classroom.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors mb-2 text-foreground">
                              {classroom.name}
                            </h3>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Badge variant="secondary" className="bg-muted text-muted-foreground h-5 text-[10px]">
                                  {classroom.subject}
                                </Badge>
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(classroom.start_date, 'long')} - {formatDate(classroom.end_date, 'long')}
                              </span>
                              {classroom.teacher_profiles && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                  <Avatar className="h-4 w-4">
                                    {classroom.teacher_profiles.avatar_url && (
                                      <AvatarImage src={classroom.teacher_profiles.avatar_url} />
                                    )}
                                    <AvatarFallback className="text-[8px] bg-primary/5 text-primary">
                                      {(classroom.teacher_profiles.full_name || 'T').charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  {classroom.teacher_profiles.full_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    // Detailed View
                    <Card
                      key={classroom.id}
                      className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
                      onClick={() => navigate(`/student/classroom/${classroom.id}`)}
                    >
                      <CardContent className="p-5">
                        <div className="mb-4">
                          <h3 className="font-bold text-lg mb-2 truncate group-hover:text-primary transition-colors text-foreground">
                            {classroom.name}
                          </h3>
                          <Badge variant="secondary" className="bg-muted text-muted-foreground">
                            {classroom.subject}
                          </Badge>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-border">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <Clock className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Status</p>
                                <p className="font-bold text-sm text-foreground">Active</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Dates</p>
                                <p className="font-semibold text-[10px] text-foreground">{formatDate(classroom.start_date)} - {formatDate(classroom.end_date)}</p>
                              </div>
                            </div>
                          </div>
                          {classroom.teacher_profiles && (
                            <div className="flex items-center gap-3 pt-2">
                              <Avatar className="h-8 w-8">
                                {classroom.teacher_profiles.avatar_url && (
                                  <AvatarImage src={classroom.teacher_profiles.avatar_url} />
                                )}
                                <AvatarFallback className="bg-primary/5 text-primary">
                                  {(classroom.teacher_profiles.full_name || 'T').charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Teacher</p>
                                <p className="text-xs font-medium text-foreground">{classroom.teacher_profiles.full_name}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                ))}
              </div>
            )}
          </section>

          {/* Assignments Section */}
          <section>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-xl font-semibold text-foreground">{t('studentDashboard.myAssignments')}</h2>

              <div className="flex items-center gap-3 bg-muted/50 p-1 rounded-full border border-border/50">
                <Tabs value={assignmentsTab} onValueChange={(v) => setAssignmentsTab(v as 'active' | 'finished')} className="w-auto">
                  <TabsList className="h-9 bg-transparent p-0 flex gap-1 border-none">
                    <TabsTrigger
                      value="active"
                      className="rounded-full px-6 py-1.5 text-sm font-medium text-muted-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm hover:text-foreground transition-all border-none"
                    >
                      {t('common.active')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="finished"
                      className="rounded-full px-6 py-1.5 text-sm font-medium text-muted-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm hover:text-foreground transition-all border-none"
                    >
                      {t('common.finished')}
                    </TabsTrigger>
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
                    <SelectTrigger className="w-[180px] rounded-full border-border bg-card text-foreground">
                      <SelectValue>{t('studentDashboard.sortBy')}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-card">
                      <SelectItem value="due-date">{t('studentDashboard.sortOptions.dueDate')}</SelectItem>
                      <SelectItem value="recent">{t('studentDashboard.sortOptions.recent')}</SelectItem>
                      <SelectItem value="oldest">{t('studentDashboard.sortOptions.oldest')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {loading ? (
                <SkeletonRowList count={2} />
              ) : assignmentsTab === 'active' ? (
                assignments.length === 0 ? (
                  <EmptyState
                    icon={Sparkles}
                    title={t('studentDashboard.empty.noAssignments')}
                    description={t('studentDashboard.empty.noAssignmentsDescription')}
                  />
                ) : (
                  <div ref={assignmentsRef} className="space-y-3">
                    {getSortedAssignments().map((assignment) => {
                      const teacherProfile = Array.isArray(assignment.classrooms.teacher_profiles)
                        ? assignment.classrooms.teacher_profiles[0]
                        : assignment.classrooms.teacher_profiles;

                      const teacherName = teacherProfile?.full_name || t('common.teacher');
                      const teacherInitials = teacherName
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase() || 'T';

                      return (
                        <Card
                          key={assignment.id}
                          className="group hover:shadow-md transition-all duration-200 cursor-pointer border-none shadow-sm rounded-xl bg-card overflow-hidden ring-1 ring-border"
                          onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center p-2">
                            <div className="p-4 flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="rounded-full border-primary/20 text-primary bg-primary/10">
                                  {assignment.classrooms.name}
                                </Badge>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {t('common.due')}: {new Date(assignment.due_at).toLocaleDateString()}
                                </span>
                              </div>
                              <h3 className="text-lg font-bold group-hover:text-primary transition-colors text-foreground">
                                {assignment.title}
                              </h3>
                            </div>

                            <div className="flex items-center gap-3 px-4 pb-4 sm:pb-0 sm:border-s border-border sm:ps-6">
                              <div className="text-end hidden sm:block">
                                <p className="text-xs text-muted-foreground">{t('common.teacher')}</p>
                                <p className="text-sm font-medium truncate max-w-[100px] text-foreground">
                                  {teacherName}
                                </p>
                              </div>
                              <Avatar className="h-10 w-10 border-2 border-card shadow-sm">
                                {teacherProfile?.avatar_url && (
                                  <AvatarImage
                                    src={teacherProfile.avatar_url}
                                    alt={teacherName}
                                  />
                                )}
                                <AvatarFallback className="bg-primary/10 text-primary">{teacherInitials}</AvatarFallback>
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
                  <EmptyState
                    icon={BookOpen}
                    title={t('studentClassroom.noFinishedAssignments')}
                    description={t('studentClassroom.noFinishedAssignmentsDesc')}
                  />
                ) : (
                  <div className="space-y-3">
                    {getSortedAssignments(finishedAssignments).map((assignment) => {
                      const teacherProfile = Array.isArray(assignment.classrooms.teacher_profiles)
                        ? assignment.classrooms.teacher_profiles[0]
                        : assignment.classrooms.teacher_profiles;

                      const teacherName = teacherProfile?.full_name || t('common.teacher');
                      const teacherInitials = teacherName
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase() || 'T';

                      return (
                        <Card
                          key={assignment.id}
                          className="group hover:shadow-md transition-all duration-200 cursor-pointer border-none shadow-sm rounded-xl bg-muted/20 overflow-hidden opacity-80 hover:opacity-100 ring-1 ring-border"
                          onClick={() => navigate(`/student/assignment/${assignment.id}`)}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center p-2">
                            <div className="p-4 flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="rounded-full bg-muted text-muted-foreground">
                                  {assignment.classrooms.name}
                                </Badge>
                                <Badge className="rounded-full bg-success/10 text-success hover:bg-success/20 border-none">
                                  {t('common.completed')}
                                </Badge>
                              </div>
                              <h3 className="text-lg font-bold text-foreground/80">
                                {assignment.title}
                              </h3>
                            </div>

                            <div className="flex items-center gap-3 px-4 pb-4 sm:pb-0 sm:border-s border-border sm:ps-6">
                              <Avatar className="h-8 w-8 grayscale opacity-70">
                                {teacherProfile?.avatar_url && (
                                  <AvatarImage
                                    src={teacherProfile.avatar_url}
                                    alt={teacherName}
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
    </DashboardLayout>
  );
};

export default StudentDashboard;
