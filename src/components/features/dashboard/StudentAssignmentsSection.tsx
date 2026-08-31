import { BookOpen, Sparkles } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { StudentDashboardAssignmentRow } from '@/components/features/dashboard/StudentDashboardAssignmentRow';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRowList } from '@/components/ui/GsapSkeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudentAssignments } from '@/hooks/queries';
import { useStaggerAnimation } from '@/hooks/useGsapAnimations';
import { useTeacherProfilesMap } from '@/hooks/useTeacherProfilesMap';
import {
  mapStudentDashboardAssignments,
  sortStudentDashboardAssignments,
  type AssignmentSortKey,
} from '@/lib/studentDashboardAssignments';

const EMPTY_QUERY_LIST: unknown[] = [];

export const StudentAssignmentsSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: assignmentsData, isLoading: assignmentsLoading } = useStudentAssignments();
  const rawAssignments = assignmentsData ?? EMPTY_QUERY_LIST;

  const [sortBy, setSortBy] = useState<AssignmentSortKey>('due-date');
  const [assignmentsTab, setAssignmentsTab] = useState<'active' | 'finished'>('active');

  const assignmentTeacherIds = useMemo(
    () =>
      rawAssignments
        .map((a) => (a as { classrooms?: { teacher_id?: string } }).classrooms?.teacher_id)
        .filter((id): id is string => Boolean(id)),
    [rawAssignments]
  );

  const { teacherProfiles } = useTeacherProfilesMap(assignmentTeacherIds);

  const allAssignments = useMemo(
    () => mapStudentDashboardAssignments(rawAssignments, teacherProfiles),
    [rawAssignments, teacherProfiles]
  );

  const assignments = useMemo(
    () => allAssignments.filter((a) => !a.is_completed),
    [allAssignments]
  );
  const finishedAssignments = useMemo(
    () => allAssignments.filter((a) => a.is_completed),
    [allAssignments]
  );

  const assignmentsRef = useStaggerAnimation(':scope > div', 0.06, [
    assignments.length,
    assignmentsTab,
  ]);

  const sortByLabel =
    sortBy === 'recent'
      ? t('studentDashboard.sortOptions.recent')
      : sortBy === 'oldest'
        ? t('studentDashboard.sortOptions.oldest')
        : t('studentDashboard.sortOptions.dueDate');

  const assignmentTypeLabel = (type: string | undefined) =>
    type ? t(`assignmentTypes.${type}`, { defaultValue: type }) : t('assignmentTypes.questions');

  const openAssignment = (assignmentId: string) => {
    navigate(`/student/assignment/${assignmentId}`, {
      state: { fromStudentDashboard: true },
    });
  };

  const listForTab =
    assignmentsTab === 'active'
      ? sortStudentDashboardAssignments(assignments, sortBy)
      : sortStudentDashboardAssignments(finishedAssignments, sortBy);

  return (
    <section>
      <div className="flex flex-col sm:flex-row justify-start items-start gap-4 flex-wrap mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t('studentDashboard.myAssignments')}
        </h2>

        <div className="flex items-center gap-3 bg-muted/50 p-1 rounded-full">
          <Tabs
            value={assignmentsTab}
            onValueChange={(v) => setAssignmentsTab(v as 'active' | 'finished')}
            className="w-auto"
          >
            <TabsList className="h-9 bg-transparent p-0 flex gap-1 border-none">
              <TabsTrigger
                value="active"
                className="rounded-full px-6 py-1.5 text-sm text-muted-foreground data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm hover:text-foreground transition-all border-none"
              >
                {t('common.active')}
              </TabsTrigger>
              <TabsTrigger
                value="finished"
                className="rounded-full px-6 py-1.5 text-sm text-muted-foreground data-[active]:bg-background data-[active]:text-foreground data-[active]:shadow-sm hover:text-foreground transition-all border-none"
              >
                {t('common.finished')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="space-y-4">
        {!assignmentsLoading &&
          (assignmentsTab === 'active'
            ? assignments.length > 0
            : finishedAssignments.length > 0) && (
            <div className="flex justify-end mb-2">
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as AssignmentSortKey)}
              >
                <SelectTrigger className="w-[180px] rounded-full border-border bg-card text-foreground">
                  <SelectValue>{sortByLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl bg-card">
                  <SelectItem value="due-date">
                    {t('studentDashboard.sortOptions.dueDate')}
                  </SelectItem>
                  <SelectItem value="recent">{t('studentDashboard.sortOptions.recent')}</SelectItem>
                  <SelectItem value="oldest">{t('studentDashboard.sortOptions.oldest')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

        {assignmentsLoading ? (
          <SkeletonRowList count={2} />
        ) : assignmentsTab === 'active' ? (
          assignments.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={t('studentDashboard.empty.noAssignments')}
              description={t('studentDashboard.empty.noAssignmentsDescription')}
            />
          ) : (
            <div ref={assignmentsRef} className="space-y-6">
              {listForTab.map((assignment) => (
                <StudentDashboardAssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  variant="active"
                  assignmentTypeLabel={assignmentTypeLabel(assignment.type)}
                  onClick={() => openAssignment(assignment.id)}
                />
              ))}
            </div>
          )
        ) : finishedAssignments.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t('studentClassroom.noFinishedAssignments')}
            description={t('studentClassroom.noFinishedAssignmentsDesc')}
          />
        ) : (
          <div className="space-y-6">
            {listForTab.map((assignment) => (
              <StudentDashboardAssignmentRow
                key={assignment.id}
                assignment={assignment}
                variant="finished"
                assignmentTypeLabel={assignmentTypeLabel(assignment.type)}
                onClick={() => openAssignment(assignment.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
