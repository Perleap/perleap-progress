import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, BookOpen, Copy, LayoutGrid, List, Grid2x2, LayoutList, Table2, CalendarDays, Calendar } from 'lucide-react';
import { ClassroomTableView } from '@/components/features/dashboard/ClassroomTableView';
import { ClassroomTimelineView } from '@/components/features/dashboard/ClassroomTimelineView';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CreateClassroomDialog } from '@/components/CreateClassroomDialog';
import { TeacherCalendar } from '@/components/TeacherCalendar';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layouts';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { SkeletonCardGrid } from '@/components/ui/GsapSkeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { copyToClipboard } from '@/lib/utils';
import { useClassrooms } from '@/hooks/queries';

interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  start_date?: string | null;
  end_date?: string | null;
  _count?: { enrollments: number };
}

interface CalendarClassroom {
  id: string;
  name: string;
  subject: string;
  start_date: string | null;
  end_date: string | null;
}

const TeacherDashboard = () => {
  const { t } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const { 
    data: rawClassrooms = [], 
    isLoading: classroomsLoading,
    refetch: refetchClassrooms
  } = useClassrooms('teacher');

  // Memoize classrooms cast to prevent unnecessary re-renders
  const classrooms = useMemo(() => rawClassrooms as unknown as Classroom[], [rawClassrooms]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact' | 'detailed' | 'table' | 'timeline'>('grid');
  
  // Only trigger stagger animation when classrooms data or viewMode changes
  const cardsRef = useStaggerAnimation(':scope > div', 0.08, [classrooms.length, viewMode]);

  const handleClassroomCreated = (classroomId: string) => {
    refetchClassrooms();
    navigate(`/teacher/classroom/${classroomId}`);
  };

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

  // Memoize calendar data
  const calendarClassrooms: CalendarClassroom[] = useMemo(() => classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    start_date: c.start_date || null,
    end_date: c.end_date || null,
  })), [classrooms]);

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <DashboardLayout breadcrumbs={[{ label: t('nav.dashboard') }]}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">{t('common.loading')}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard' }
      ]}
    >
      {/* Enhanced Page Header */}
      <div className="relative -mx-6 md:-mx-8 lg:-mx-10 -mt-6 md:-mt-8 lg:-mt-10 px-6 md:px-8 lg:px-10 pt-8 md:pt-10 lg:pt-12 pb-8 md:pb-10 mb-8 md:mb-10 overflow-hidden bg-muted/30">
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground truncate">
                {profile?.full_name ? `${profile.full_name}'s Dashboard` : t('teacherDashboard.title')}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm md:text-base truncate">{t('teacherDashboard.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_420px] gap-6 md:gap-8 xl:gap-10">
        <div className="space-y-6 md:space-y-8">
          {/* Section Header with Enhanced Button */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{t('teacherDashboard.myClassrooms')}</h2>
                <p className="text-sm md:text-base text-muted-foreground mt-2">Manage and track your classes</p>
              </div>
              <Button
                onClick={() => setDialogOpen(true)}
                size="lg"
                className="gap-2 w-full sm:w-auto flex-shrink-0"
              >
                <Plus className="h-5 w-5" />
                <span className="whitespace-nowrap">{t('teacherDashboard.createClassroom')}</span>
              </Button>
            </div>

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
          </div>

          {classroomsLoading ? (
            <SkeletonCardGrid count={4} />
          ) : classrooms.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t('teacherDashboard.empty.title')}
              description={t('teacherDashboard.empty.description')}
              action={{
                label: t('teacherDashboard.createClassroom'),
                onClick: () => setDialogOpen(true),
              }}
            />
          ) : viewMode === 'table' ? (
            <ClassroomTableView
              classrooms={classrooms}
              onCopyInviteCode={(code) => console.log('Copied:', code)}
            />
          ) : viewMode === 'timeline' ? (
            <ClassroomTimelineView
              classrooms={classrooms}
              onCopyInviteCode={(code) => console.log('Copied:', code)}
            />
          ) : (
            <div
              ref={cardsRef}
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
                    onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                  >
                    <CardContent className="p-4 relative">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base mb-2 truncate group-hover:text-primary transition-colors text-foreground">
                            {classroom.name}
                          </h3>
                        </div>
                      </div>

                      <div className="space-y-2 pt-3 border-t border-border">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span className="font-medium">{classroom._count?.enrollments || 0} students</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDate(classroom.start_date)}</span>
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer transition-all duration-200 hover:scale-105 w-full justify-center"
                          onClick={(e) => handleCopyInviteCode(e, classroom.invite_code)}
                        >
                          <span className="text-xs font-mono font-semibold text-primary">{classroom.invite_code}</span>
                          <Copy className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : viewMode === 'compact' ? (
                  // Compact View
                  <Card
                    key={classroom.id}
                    className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
                    onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                  >
                    <CardContent className="p-3">
                      <div className="mb-2">
                        <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors text-foreground">
                          {classroom.name}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>{classroom._count?.enrollments || 0}</span>
                          <span className="mx-1">•</span>
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(classroom.start_date)}</span>
                        </div>
                        <div
                          className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer transition-all w-full justify-center"
                          onClick={(e) => handleCopyInviteCode(e, classroom.invite_code)}
                        >
                          <span className="font-mono text-xs font-semibold text-primary">{classroom.invite_code}</span>
                          <Copy className="h-3 w-3 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : viewMode === 'list' ? (
                  // List View
                  <Card
                    key={classroom.id}
                    className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
                    onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors mb-2 text-foreground">
                            {classroom.name}
                          </h3>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {classroom._count?.enrollments || 0} {t('common.students')}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(classroom.start_date, 'long')} - {formatDate(classroom.end_date, 'long')}
                            </span>
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer transition-all duration-200 hover:scale-105"
                          onClick={(e) => handleCopyInviteCode(e, classroom.invite_code)}
                        >
                          <span className="text-sm font-mono font-semibold text-primary">{classroom.invite_code}</span>
                          <Copy className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  // Detailed View
                  <Card
                    key={classroom.id}
                    className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
                    onClick={() => navigate(`/teacher/classroom/${classroom.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="mb-4">
                        <h3 className="font-bold text-lg mb-2 truncate group-hover:text-primary transition-colors text-foreground">
                          {classroom.name}
                        </h3>
                      </div>
                      <div className="space-y-3 pt-4 border-t border-border">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                              <Users className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Students</p>
                              <p className="font-bold text-foreground">{classroom._count?.enrollments || 0}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                              <Calendar className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Duration</p>
                              <p className="font-semibold text-xs text-foreground">{formatDate(classroom.start_date)} - {formatDate(classroom.end_date)}</p>
                            </div>
                          </div>
                        </div>
                        <div
                          className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer transition-all duration-200 hover:scale-105 w-full justify-center"
                          onClick={(e) => handleCopyInviteCode(e, classroom.invite_code)}
                        >
                          <span className="text-sm font-mono font-semibold text-primary">{classroom.invite_code}</span>
                          <Copy className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              ))}
            </div>
          )}
        </div>

        {/* Calendar Sidebar */}
        <aside className="space-y-6 md:space-y-8">
          {user && (
            <div className="lg:sticky lg:top-6 space-y-6">
              <RecentActivity />
              <TeacherCalendar
                teacherId={user.id}
                classrooms={calendarClassrooms}
                loading={classroomsLoading}
              />
            </div>
          )}
        </aside>
      </div>

      <CreateClassroomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleClassroomCreated}
      />
    </DashboardLayout>
  );
};
export default TeacherDashboard;
