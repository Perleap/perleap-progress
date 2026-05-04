import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Copy, Calendar, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { copyToClipboard, cn } from '@/lib/utils';
import { useWholeCourseCurriculumProgress } from '@/hooks/useWholeCourseCurriculumProgress';
import type { StudentTimelineCurriculumProgressMap } from '@/hooks/useStudentTimelineCurriculaProgress';

interface Classroom {
  id: string;
  name: string;
  subject: string;
  invite_code: string;
  start_date?: string | null;
  end_date?: string | null;
  teacher_profiles?: { full_name: string; avatar_url?: string } | null;
  _count?: { enrollments: number };
}

interface ClassroomTimelineViewProps {
  classrooms: Classroom[];
  onCopyInviteCode?: (inviteCode: string) => void;
  variant?: 'teacher' | 'student';
  /** Logged-in student id; curriculum progress uses syllabus + flow when set (student variant). */
  studentUserId?: string;
  /** When true (student timeline from dashboard), progress comes from batched loader — no per-card hooks. */
  studentCurriculumBatched?: boolean;
  studentCurriculumProgress?: StudentTimelineCurriculumProgressMap;
  studentCurriculumLoading?: boolean;
}

type ClassroomWithStatus = Classroom & {
  status: 'upcoming' | 'active' | 'completed';
  progress?: number;
};

function TimelineClassroomCard({
  classroom,
  variant,
  studentUserId,
  studentCurriculumBatched,
  studentCurriculumEntry,
  studentCurriculumLoading,
  classroomPath,
  onNavigate,
  onCopyCode,
}: {
  classroom: ClassroomWithStatus;
  variant: 'teacher' | 'student';
  studentUserId?: string;
  studentCurriculumBatched?: boolean;
  studentCurriculumEntry?: StudentTimelineCurriculumProgressMap[string];
  studentCurriculumLoading?: boolean;
  classroomPath: (id: string) => string;
  onNavigate: (path: string) => void;
  onCopyCode: (e: React.MouseEvent, code: string) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const isStudent = variant === 'student';

  const useHookForCurriculum = Boolean(isStudent && studentUserId && !studentCurriculumBatched);

  const curriculum = useWholeCourseCurriculumProgress(
    classroom.id,
    studentUserId,
    useHookForCurriculum,
  );

  const teacherProgressPct = classroom.progress;

  const studentProgressPctBatched =
    Boolean(isStudent && studentCurriculumBatched) &&
    !studentCurriculumLoading &&
    Boolean(studentCurriculumEntry?.meaningful)
      ? studentCurriculumEntry?.percent
      : undefined;

  const studentProgressPctFromHook =
    useHookForCurriculum && !curriculum.isLoading && curriculum.meaningful ? curriculum.percent : undefined;

  const studentProgressPct =
    typeof studentProgressPctBatched === 'number' ? studentProgressPctBatched : studentProgressPctFromHook;

  const studentCurriculumLoadingInner = Boolean(
    isStudent &&
      studentUserId &&
      (studentCurriculumBatched ? !!studentCurriculumLoading : curriculum.isLoading),
  );

  /** Batched timeline: not loading (`!studentCurriculumLoading`, same rule as pct). Hook: idle. */
  const studentCurriculumResolved = Boolean(
    isStudent &&
      studentUserId &&
      (studentCurriculumBatched
        ? Boolean(!studentCurriculumLoading)
        : Boolean(useHookForCurriculum && !curriculum.isLoading)),
  );

  /** After load but no countable curriculum progression (still reserve space vs blank). */
  const showStudentCurriculumUnavailable = Boolean(
    isStudent &&
      studentUserId &&
      studentCurriculumResolved &&
      studentProgressPct === undefined &&
      (studentCurriculumBatched
        ? /* missing map entry counts as unresolved until batch finishes; resolved handles that */
          !studentCurriculumEntry?.meaningful
        : useHookForCurriculum && !curriculum.meaningful),
  );

  const showStudentProgressBar = Boolean(
    isStudent && studentUserId && !studentCurriculumLoadingInner && studentProgressPct !== undefined,
  );

  const showStudentCurriculumSlot = Boolean(isStudent && studentUserId);

  const showTeacherProgressBar = !isStudent && teacherProgressPct !== undefined;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const teacherFilledMuted =
    teacherProgressPct !== undefined &&
    (teacherProgressPct >= 100 || classroom.status !== 'active');
  const studentFilledMuted =
    studentProgressPct !== undefined &&
    (studentProgressPct >= 100 || classroom.status !== 'active');

  return (
    <Card
      className="group cursor-pointer border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 bg-card"
      onClick={() => onNavigate(classroomPath(classroom.id))}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors text-foreground">
                {classroom.name}
              </h3>
            </div>

            <div className="mb-3 min-w-0">
              {isStudent ? (
                <p className="text-sm text-muted-foreground truncate" title={classroom.teacher_profiles?.full_name}>
                  {classroom.teacher_profiles?.full_name?.trim()
                    ? classroom.teacher_profiles.full_name
                    : t('studentDashboard.timeline.teacherNameFallback')}
                </p>
              ) : classroom.subject ? (
                <p className="text-sm text-muted-foreground truncate" title={classroom.subject}>
                  {classroom.subject}
                </p>
              ) : null}
            </div>

            {showTeacherProgressBar ? (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{t('common.progress')}</span>
                  <span className="font-semibold text-foreground">{teacherProgressPct}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      teacherFilledMuted ? 'bg-muted-foreground/50' : 'bg-primary',
                    )}
                    style={{ width: `${teacherProgressPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            {showStudentCurriculumSlot ? (
              <div
                className="mb-3 min-h-[3.125rem] flex flex-col justify-center gap-2"
                aria-busy={studentCurriculumLoadingInner}
              >
                {studentCurriculumLoadingInner ? (
                  <>
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      {t('studentDashboard.timeline.loadingProgress')}
                    </p>
                    <div className="space-y-2 animate-pulse" aria-hidden>
                      <div className="flex items-center justify-between gap-4">
                        <div className="h-3 w-14 bg-muted rounded" />
                        <div className="h-3 w-9 bg-muted rounded" />
                      </div>
                      <div className="h-2 bg-muted rounded-full" />
                    </div>
                  </>
                ) : showStudentProgressBar ? (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{t('common.progress')}</span>
                      <span className="font-semibold text-foreground">{studentProgressPct}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-300',
                          studentFilledMuted ? 'bg-muted-foreground/50' : 'bg-primary',
                        )}
                        style={{ width: `${studentProgressPct}%` }}
                      />
                    </div>
                  </div>
                ) : showStudentCurriculumUnavailable ? (
                  <p className="text-xs text-muted-foreground leading-snug">
                    {t('studentDashboard.timeline.progressUnavailable')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!isStudent ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {formatDate(classroom.start_date)} – {formatDate(classroom.end_date)}
                </span>
              </div>
            ) : null}

            <div className="flex items-center gap-2 justify-between pt-3 border-t border-border">
              {!isStudent ? (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {classroom._count?.enrollments || 0}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1 pr-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {formatDate(classroom.start_date)} – {formatDate(classroom.end_date)}
                  </span>
                </div>
              )}
              {isStudent ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-8 w-8 rounded-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(classroomPath(classroom.id));
                  }}
                  aria-label={t('studentDashboard.enterCourse')}
                  title={t('studentDashboard.enterCourse')}
                >
                  <LogIn className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <div
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 cursor-pointer transition-all duration-200 hover:scale-105"
                  onClick={(e) => onCopyCode(e, classroom.invite_code)}
                >
                  <span className="text-xs font-mono font-semibold text-primary">
                    {classroom.invite_code}
                  </span>
                  <Copy className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ClassroomTimelineView({
  classrooms,
  onCopyInviteCode,
  variant = 'teacher',
  studentUserId,
  studentCurriculumBatched,
  studentCurriculumProgress,
  studentCurriculumLoading,
}: ClassroomTimelineViewProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isStudent = variant === 'student';

  const classroomPath = (id: string) =>
    isStudent ? `/student/classroom/${id}` : `/teacher/classroom/${id}`;

  const categorizedClassrooms = useMemo(() => {
    const now = new Date();

    const withStatus: ClassroomWithStatus[] = classrooms.map((classroom) => {
      const startDate = classroom.start_date ? new Date(classroom.start_date) : null;
      const endDate = classroom.end_date ? new Date(classroom.end_date) : null;

      let status: 'upcoming' | 'active' | 'completed' = 'active';
      let progress: number | undefined;

      if (startDate && endDate) {
        if (now < startDate) {
          status = 'upcoming';
        } else if (now > endDate) {
          status = 'completed';
          progress = 100;
        } else {
          status = 'active';
          const total = endDate.getTime() - startDate.getTime();
          const elapsed = now.getTime() - startDate.getTime();
          progress = Math.round((elapsed / total) * 100);
        }
      } else if (startDate && now < startDate) {
        status = 'upcoming';
      } else if (endDate && now > endDate) {
        status = 'completed';
        progress = 100;
      }

      return { ...classroom, status, progress };
    });

    return {
      upcoming: withStatus.filter((c) => c.status === 'upcoming'),
      active: withStatus.filter((c) => c.status === 'active'),
      completed: withStatus.filter((c) => c.status === 'completed'),
    };
  }, [classrooms]);

  const handleCopyCode = async (e: React.MouseEvent, inviteCode: string) => {
    e.stopPropagation();
    try {
      await copyToClipboard(inviteCode);
      toast.success(t('teacherDashboard.success.inviteCodeCopied'));
      onCopyInviteCode?.(inviteCode);
    } catch {
      toast.error(t('common.error'));
    }
  };

  const renderCard = (classroom: ClassroomWithStatus) => (
    <TimelineClassroomCard
      key={classroom.id}
      classroom={classroom}
      variant={variant}
      studentUserId={studentUserId}
      studentCurriculumBatched={studentCurriculumBatched}
      studentCurriculumEntry={studentCurriculumProgress?.[classroom.id]}
      studentCurriculumLoading={studentCurriculumLoading}
      classroomPath={classroomPath}
      onNavigate={(path) => navigate(path)}
      onCopyCode={handleCopyCode}
    />
  );

  return (
    <div className="space-y-8">
      {categorizedClassrooms.active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <h3 className="text-lg font-bold">
              {t('common.active') || 'Active'} ({categorizedClassrooms.active.length})
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categorizedClassrooms.active.map(renderCard)}
          </div>
        </div>
      )}

      {categorizedClassrooms.upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h3 className="text-lg font-bold">
              {t('common.upcoming') || 'Upcoming'} ({categorizedClassrooms.upcoming.length})
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categorizedClassrooms.upcoming.map(renderCard)}
          </div>
        </div>
      )}

      {categorizedClassrooms.completed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 w-2 rounded-full bg-gray-400" />
            <h3 className="text-lg font-bold">
              {t('common.completed') || 'Completed'} ({categorizedClassrooms.completed.length})
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categorizedClassrooms.completed.map(renderCard)}
          </div>
        </div>
      )}

      {classrooms.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('teacherDashboard.empty.title') || 'No classrooms found'}</p>
        </div>
      )}
    </div>
  );
}
