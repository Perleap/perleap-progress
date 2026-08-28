import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  BookOpen,
  Clock,
  LayoutGrid,
  List,
  Grid2x2,
  LayoutList,
  Table2,
  CalendarDays,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SecureAvatarImage } from '@/components/ui/SecureAvatarImage';
import { TEACHER_AVATARS_BUCKET } from '@/utils/storageUrls';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SkeletonCardGrid } from '@/components/ui/GsapSkeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/contexts/useAuth';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { useTeacherProfilesMap } from '@/hooks/useTeacherProfilesMap';
import { useStudentTimelineCurriculaProgress } from '@/hooks/useStudentTimelineCurriculaProgress';
import { prefetchSyllabusByClassroom, useClassrooms } from '@/hooks/queries';
import { ClassroomTableView } from '@/components/features/dashboard/ClassroomTableView';
import { ClassroomTimelineView } from '@/components/features/dashboard/ClassroomTimelineView';
import { JoinClassroomDialog } from '@/components/features/dashboard/JoinClassroomDialog';
import {
  type ClassroomViewMode,
  formatClassroomDate,
  getClassroomViewModeLabel,
} from '@/lib/classroomViewMode';

const EMPTY_QUERY_LIST: unknown[] = [];

export type StudentEnrolledClassroom = {
  id: string;
  name: string;
  subject: string;
  start_date?: string | null;
  end_date?: string | null;
  invite_code: string;
  teacher_profiles?: { full_name: string; avatar_url?: string } | null;
};

export function StudentClassroomsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: classroomsData, isLoading: classroomsLoading, refetch: refetchClassrooms } =
    useClassrooms('student');
  const rawClassrooms = classroomsData ?? EMPTY_QUERY_LIST;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ClassroomViewMode>('timeline');

  const teacherIds = useMemo(
    () =>
      rawClassrooms
        .map((c: { teacher_id?: string }) => c.teacher_id)
        .filter((id): id is string => Boolean(id)),
    [rawClassrooms],
  );

  const { teacherProfiles, isPending: teacherProfilesPending } = useTeacherProfilesMap(teacherIds);

  const classrooms: StudentEnrolledClassroom[] = useMemo(
    () =>
      rawClassrooms.map((c: {
        id: string;
        name: string;
        subject: string;
        start_date?: string | null;
        end_date?: string | null;
        invite_code: string;
        teacher_id?: string;
      }) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        start_date: c.start_date,
        end_date: c.end_date,
        invite_code: c.invite_code,
        teacher_profiles: (c.teacher_id && teacherProfiles[c.teacher_id]) || null,
      })),
    [rawClassrooms, teacherProfiles],
  );

  const timelineClassroomIds = useMemo(
    () => rawClassrooms.map((c: { id: string }) => String(c.id)).filter(Boolean),
    [rawClassrooms],
  );

  const timelineBatchEnabled = Boolean(user?.id && timelineClassroomIds.length > 0);

  const { data: timelineCurricula = {}, isPending: timelineCurriculaPending } =
    useStudentTimelineCurriculaProgress(user?.id, timelineClassroomIds, timelineBatchEnabled);

  const sectionLoading =
    classroomsLoading ||
    (teacherIds.length > 0 && teacherProfilesPending) ||
    (timelineBatchEnabled && timelineCurriculaPending);

  const warmSyllabusForClassroom = useCallback(
    (classroomId: string) => {
      void prefetchSyllabusByClassroom(queryClient, classroomId);
    },
    [queryClient],
  );

  const classroomsRef = useStaggerAnimation(':scope > div', 0.08, [classrooms.length, viewMode]);

  const openClassroom = (classroomId: string) => {
    navigate(`/student/classroom/${classroomId}`);
  };

  const cardWarmHandlers = (classroomId: string) => ({
    onMouseEnter: () => warmSyllabusForClassroom(classroomId),
    onPointerDown: () => warmSyllabusForClassroom(classroomId),
    onClick: () => openClassroom(classroomId),
  });

  return (
    <section>
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">{t('studentDashboard.myClasses')}</h2>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {classrooms.length > 0 && (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground mr-2">{t('classroomList.viewLabel')}</span>
              <Select value={viewMode} onValueChange={(value) => setViewMode(value as ClassroomViewMode)}>
                <SelectTrigger className="w-[180px] bg-card">
                  <SelectValue>
                    <span>{getClassroomViewModeLabel(viewMode, t)}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="grid">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      <span>{t('classroomList.viewModes.grid')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="compact">
                    <div className="flex items-center gap-2">
                      <Grid2x2 className="h-4 w-4" />
                      <span>{t('classroomList.viewModes.compact')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="list">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      <span>{t('classroomList.viewModes.list')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="detailed">
                    <div className="flex items-center gap-2">
                      <LayoutList className="h-4 w-4" />
                      <span>{t('classroomList.viewModes.detailed')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="table">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-4 w-4" />
                      <span>{t('classroomList.viewModes.table')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="timeline">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>{t('classroomList.viewModes.timeline')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <JoinClassroomDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onJoined={() => {
              void refetchClassrooms();
            }}
            trigger={
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                {t('studentDashboard.joinClass')}
              </Button>
            }
          />
        </div>
      </div>

      {sectionLoading ? (
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
        <ClassroomTableView classrooms={classrooms} variant="student" />
      ) : viewMode === 'timeline' ? (
        <ClassroomTimelineView
          classrooms={classrooms}
          variant="student"
          studentUserId={user?.id}
          studentCurriculumBatched
          studentCurriculumProgress={timelineCurricula}
          studentCurriculumLoading={false}
        />
      ) : (
        <div
          ref={classroomsRef}
          className={
            viewMode === 'grid'
              ? 'grid gap-4'
              : viewMode === 'compact'
                ? 'grid gap-3'
                : viewMode === 'list'
                  ? 'flex flex-col gap-4'
                  : 'grid gap-5'
          }
          style={
            viewMode === 'grid'
              ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }
              : viewMode === 'compact'
                ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))' }
                : viewMode === 'detailed'
                  ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(350px, 100%), 1fr))' }
                  : undefined
          }
        >
          {classrooms.map((classroom) =>
            viewMode === 'grid' ? (
              <Card
                key={classroom.id}
                className="group relative overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-200 active:scale-[0.98] bg-card border-border"
                {...cardWarmHandlers(classroom.id)}
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
                        <span>{formatClassroomDate(classroom.start_date, { unavailable: t('classroomList.dateUnavailable') })}</span>
                      </div>
                    </div>

                    {classroom.teacher_profiles && (
                      <div className="flex items-center gap-2 pt-1">
                        <Avatar className="h-6 w-6 border border-background">
                          {classroom.teacher_profiles.avatar_url && (
                            <SecureAvatarImage
                              src={classroom.teacher_profiles.avatar_url}
                              bucket={TEACHER_AVATARS_BUCKET}
                              alt=""
                            />
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
              <Card
                key={classroom.id}
                className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
                {...cardWarmHandlers(classroom.id)}
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
                      <span>{formatClassroomDate(classroom.start_date, { unavailable: t('classroomList.dateUnavailable') })}</span>
                    </div>
                    {classroom.teacher_profiles && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Avatar className="h-4 w-4">
                          {classroom.teacher_profiles.avatar_url && (
                            <SecureAvatarImage
                              src={classroom.teacher_profiles.avatar_url}
                              bucket={TEACHER_AVATARS_BUCKET}
                              alt=""
                            />
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
              <Card
                key={classroom.id}
                className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
                {...cardWarmHandlers(classroom.id)}
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
                          {formatClassroomDate(classroom.start_date, { format: 'long', unavailable: t('classroomList.dateUnavailable') })} - {formatClassroomDate(classroom.end_date, { format: 'long', unavailable: t('classroomList.dateUnavailable') })}
                        </span>
                        {classroom.teacher_profiles && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Avatar className="h-4 w-4">
                              {classroom.teacher_profiles.avatar_url && (
                                <SecureAvatarImage
                                  src={classroom.teacher_profiles.avatar_url}
                                  bucket={TEACHER_AVATARS_BUCKET}
                                  alt=""
                                />
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
              <Card
                key={classroom.id}
                className="group cursor-pointer hover:border-primary/30 transition-all duration-200 bg-card border-border"
                {...cardWarmHandlers(classroom.id)}
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
                          <p className="font-semibold text-[10px] text-foreground">
                            {formatClassroomDate(classroom.start_date, { unavailable: t('classroomList.dateUnavailable') })} - {formatClassroomDate(classroom.end_date, { unavailable: t('classroomList.dateUnavailable') })}
                          </p>
                        </div>
                      </div>
                    </div>
                    {classroom.teacher_profiles && (
                      <div className="flex items-center gap-3 pt-2">
                        <Avatar className="h-8 w-8">
                          {classroom.teacher_profiles.avatar_url && (
                            <SecureAvatarImage
                              src={classroom.teacher_profiles.avatar_url}
                              bucket={TEACHER_AVATARS_BUCKET}
                              alt=""
                            />
                          )}
                          <AvatarFallback className="bg-primary/5 text-primary">
                            {(classroom.teacher_profiles.full_name || 'T').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-[10px] text-muted-foreground">Teacher</p>
                          <p className="text-xs font-medium text-foreground">
                            {classroom.teacher_profiles.full_name}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </section>
  );
}
