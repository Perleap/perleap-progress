import { Plus, BookOpen } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ClassroomWithEnrollmentCount } from '@/types/api.types';
import { CreateClassroomDialog } from '@/components/features/classroom/dialogs';
import { ClassroomTableView } from '@/components/features/dashboard/ClassroomTableView';
import { ClassroomTimelineView } from '@/components/features/dashboard/ClassroomTimelineView';
import {
  ClassroomViewModeSelect,
  TeacherClassroomCard,
  getClassroomCardsContainerProps,
} from '@/components/features/dashboard/shared';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCardGrid } from '@/components/ui/GsapSkeleton';
import { useClassrooms } from '@/hooks/queries';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { type ClassroomViewMode } from '@/lib/classroomViewMode';
import { copyToClipboard } from '@/lib/utils';

const CARD_VIEW_MODES = ['grid', 'compact', 'list', 'detailed'] as const;

export const TeacherClassroomsSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    data: rawClassrooms = [],
    isLoading: classroomsLoading,
    refetch: refetchClassrooms,
  } = useClassrooms('teacher');

  const classrooms = useMemo(
    () => rawClassrooms as unknown as ClassroomWithEnrollmentCount[],
    [rawClassrooms]
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ClassroomViewMode>('grid');

  const cardsRef = useStaggerAnimation(':scope > div', 0.08, [classrooms.length, viewMode]);
  const cardsContainer = getClassroomCardsContainerProps(viewMode);

  const handleClassroomCreated = (classroomId: string) => {
    refetchClassrooms();
    navigate(`/teacher/classroom/${classroomId}`);
  };

  const handleCopyInviteCode = async (e: React.MouseEvent, inviteCode: string) => {
    e.stopPropagation();
    try {
      await copyToClipboard(inviteCode);
      toast.success(t('teacherDashboard.success.inviteCodeCopied'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {t('teacherDashboard.myClassrooms')}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              Manage and track your classes
            </p>
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

        {classrooms.length > 0 && (
          <ClassroomViewModeSelect value={viewMode} onValueChange={setViewMode} />
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
        <ClassroomTableView classrooms={classrooms} variant="teacher" />
      ) : viewMode === 'timeline' ? (
        <ClassroomTimelineView classrooms={classrooms} variant="teacher" />
      ) : (
        <div ref={cardsRef} className={cardsContainer.className} style={cardsContainer.style}>
          {classrooms.map((classroom) => (
            <TeacherClassroomCard
              key={classroom.id}
              classroom={classroom}
              variant={viewMode as (typeof CARD_VIEW_MODES)[number]}
              onNavigate={() => navigate(`/teacher/classroom/${classroom.id}`)}
              onCopyInviteCode={handleCopyInviteCode}
            />
          ))}
        </div>
      )}

      <CreateClassroomDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleClassroomCreated}
      />
    </div>
  );
};
