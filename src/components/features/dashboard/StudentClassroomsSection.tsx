import { useQueryClient } from '@tanstack/react-query';
import { Plus, BookOpen } from 'lucide-react';
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ClassroomTableView } from '@/components/features/dashboard/ClassroomTableView';
import { ClassroomTimelineView } from '@/components/features/dashboard/ClassroomTimelineView';
import { JoinClassroomDialog } from '@/components/features/dashboard/JoinClassroomDialog';
import {
  ClassroomViewModeSelect,
  StudentClassroomCard,
  getClassroomCardsContainerProps,
  type StudentEnrolledClassroom,
} from '@/components/features/dashboard/shared';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCardGrid } from '@/components/ui/GsapSkeleton';
import { useAuth } from '@/contexts/useAuth';
import { prefetchSyllabusByClassroom, useClassrooms } from '@/hooks/queries';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { useStudentTimelineCurriculaProgress } from '@/hooks/useStudentTimelineCurriculaProgress';
import { useTeacherProfilesMap } from '@/hooks/useTeacherProfilesMap';
import { type ClassroomViewMode } from '@/lib/classroomViewMode';

export type { StudentEnrolledClassroom };

const EMPTY_QUERY_LIST: unknown[] = [];
const CARD_VIEW_MODES = ['grid', 'compact', 'list', 'detailed'] as const;

export const StudentClassroomsSection = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: classroomsData,
    isLoading: classroomsLoading,
    refetch: refetchClassrooms,
  } = useClassrooms('student');
  const rawClassrooms = classroomsData ?? EMPTY_QUERY_LIST;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ClassroomViewMode>('timeline');

  const teacherIds = useMemo(
    () =>
      rawClassrooms
        .map((c) => (c as { teacher_id?: string }).teacher_id)
        .filter((id): id is string => Boolean(id)),
    [rawClassrooms]
  );

  const { teacherProfiles, isPending: teacherProfilesPending } = useTeacherProfilesMap(teacherIds);

  const classrooms: StudentEnrolledClassroom[] = useMemo(
    () =>
      rawClassrooms.map((row) => {
        const c = row as {
          id: string;
          name: string;
          subject: string;
          start_date?: string | null;
          end_date?: string | null;
          invite_code: string;
          teacher_id?: string;
        };
        const profile = c.teacher_id ? teacherProfiles[c.teacher_id] : undefined;
        return {
          id: c.id,
          name: c.name,
          subject: c.subject,
          start_date: c.start_date,
          end_date: c.end_date,
          invite_code: c.invite_code,
          teacher_profiles: profile
            ? { full_name: profile.full_name ?? '', avatar_url: profile.avatar_url ?? undefined }
            : null,
        };
      }),
    [rawClassrooms, teacherProfiles]
  );

  const timelineClassroomIds = useMemo(
    () => rawClassrooms.map((c) => String((c as { id: string }).id)).filter(Boolean),
    [rawClassrooms]
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
    [queryClient]
  );

  const classroomsRef = useStaggerAnimation(':scope > div', 0.08, [classrooms.length, viewMode]);
  const cardsContainer = getClassroomCardsContainerProps(viewMode);

  return (
    <section>
      <div className="flex flex-col gap-6 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">
            {t('studentDashboard.myClasses')}
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {classrooms.length > 0 && (
            <ClassroomViewModeSelect value={viewMode} onValueChange={setViewMode} />
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
        <div ref={classroomsRef} className={cardsContainer.className} style={cardsContainer.style}>
          {classrooms.map((classroom) => (
            <StudentClassroomCard
              key={classroom.id}
              classroom={classroom}
              variant={viewMode as (typeof CARD_VIEW_MODES)[number]}
              onNavigate={() => navigate(`/student/classroom/${classroom.id}`)}
              onWarm={() => warmSyllabusForClassroom(classroom.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
};
