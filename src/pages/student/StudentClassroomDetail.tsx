import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  LayoutList,
  Loader2,
  LogOut,
} from 'lucide-react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Assignment } from '@/types';
import type { ClassroomLocationState } from '@/types/navigation';
import type { StudentProgressStatus } from '@/types/syllabus';
import { CourseResumeProgressCard } from '@/components/features/syllabus/CourseResumeProgressCard';
import { GradingBreakdownView } from '@/components/features/syllabus/GradingBreakdownView';
import { SectionContentPage } from '@/components/features/syllabus/SectionContentPage';
import { StudentActivitiesSection } from '@/components/features/syllabus/StudentActivitiesSection';
import { StudentPoliciesView } from '@/components/features/syllabus/StudentPoliciesView';
import { ClassroomLayout } from '@/components/layouts';
import SafeMathMarkdown from '@/components/SafeMathMarkdown';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/config/routes';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import {
  useClassroom,
  useClassroomAssignments,
  useTeacherProfile,
  useSyllabus,
  useStudentProgress,
  useUnenrollFromClassroom,
} from '@/hooks/queries';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import {
  useModuleFlowStepsBulk,
  useStudentCurriculumFlowContext,
  moduleFlowKeys,
} from '@/hooks/queries/useModuleFlowQueries';
import { syllabusKeys } from '@/hooks/queries/useSyllabusQueries';
import { aggregateCurriculumStepProgress } from '@/lib/curriculumStepProgress';
import { linkedAssignmentsVisibleInModuleFlow, type AssignmentRow } from '@/lib/moduleFlow';
import {
  findFirstIncompleteDisplayedFlowAcrossCourse,
  resolveStudentResumeTarget,
  resolveStudentResumeTargetWithSection,
} from '@/lib/resolveStudentResumeTarget';
import type { SectionSequentialUnlockFlow } from '@/lib/sectionUnlock';
import { getStudyCtaTarget } from '@/lib/studyCtaTarget';
import { cn } from '@/lib/utils';

const STUDENT_SECTION_IDS = new Set(['overview', 'curriculum']);

interface Classroom {
  id: string;
  name: string;
  subject: string;
  course_title: string;
  start_date: string;
  end_date: string;
  resources: string;
  learning_outcomes: string[];
  key_challenges: string[];
}

const StudentClassroomDetail = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { data: rawClassroom } = useClassroom(id);
  const { data: rawAssignments = [] } = useClassroomAssignments(id);

  const teacherId = rawClassroom?.teacher_id;
  const {
    data: teacher,
    isLoading: teacherLoading,
    isError: teacherError,
  } = useTeacherProfile(teacherId);
  const { data: syllabus, isLoading: syllabusLoading } = useSyllabus(id);
  const hasPublishedSyllabus = Boolean(syllabus && syllabus.status === 'published');
  const { data: studentProgressData, isPending: studentProgressPending } = useStudentProgress(
    syllabus?.id,
    user?.id
  );

  const syllabusSectionIds = useMemo(
    () => (syllabus?.sections ? [...syllabus.sections].map((s) => s.id) : []),
    [syllabus?.sections]
  );
  const { data: moduleFlowBulk = {}, isPending: moduleFlowBulkPending } =
    useModuleFlowStepsBulk(syllabusSectionIds);

  const { flowCtx, isLoadingProgress: curriculumFlowProgressLoading } =
    useStudentCurriculumFlowContext({
      userId: user?.id,
      sectionIds: syllabusSectionIds,
      flowBulk: moduleFlowBulk,
      resourceMap: syllabus?.section_resources ?? {},
      assignments: rawAssignments as AssignmentRow[],
      enabled: Boolean(syllabus && syllabus.status === 'published' && user?.id),
    });

  const sequentialUnlockFlow = useMemo<SectionSequentialUnlockFlow | null>(() => {
    if (!user?.id || !syllabus || syllabus.status !== 'published') return null;
    return {
      flowBulk: moduleFlowBulk,
      resourceMap: syllabus.section_resources ?? {},
      assignments: rawAssignments as AssignmentRow[],
      flowCtx,
      now: new Date(),
    };
  }, [user?.id, syllabus, moduleFlowBulk, rawAssignments, flowCtx]);

  /** Resume / About CTA depends on flow maps, module steps, and section progress; avoid stale resumeHit flash. */
  const aboutResumeTargetsReady =
    !hasPublishedSyllabus ||
    !user?.id ||
    (!curriculumFlowProgressLoading &&
      !(syllabusSectionIds.length > 0 && moduleFlowBulkPending) &&
      !studentProgressPending);

  const studentProgressMap = useMemo(() => {
    const map: Record<string, StudentProgressStatus> = {};
    if (studentProgressData) {
      studentProgressData.forEach((p) => {
        map[p.section_id] = p.status;
      });
    }
    return map;
  }, [studentProgressData]);

  const linkedAssignmentsMap = useMemo(() => {
    const map: Record<
      string,
      Array<{ id: string; title: string; type: string; due_at: string | null }>
    > = {};
    (rawAssignments as Assignment[]).forEach((a) => {
      const sectionId = a.syllabus_section_id;
      if (sectionId) {
        if (!map[sectionId]) map[sectionId] = [];
        map[sectionId].push({
          id: a.id,
          title: a.title,
          type: a.type,
          due_at: a.due_at,
        });
      }
    });
    for (const sectionId of Object.keys(map)) {
      const flow = moduleFlowBulk[sectionId];
      map[sectionId] = linkedAssignmentsVisibleInModuleFlow(map[sectionId], flow);
    }
    return map;
  }, [rawAssignments, moduleFlowBulk]);

  const [activeSection, setActiveSection] = useState(() => {
    const raw = (location.state as ClassroomLocationState | null)?.activeSection;
    let normalized = raw === 'activities' || raw === 'assignments' ? 'curriculum' : raw;
    if (normalized === 'outline') normalized = 'curriculum';
    return normalized && STUDENT_SECTION_IDS.has(normalized) ? normalized : 'overview';
  });

  /** When navigation provides activeSection (e.g. back from assignment), apply it — init only runs once. */
  useEffect(() => {
    const raw = (location.state as ClassroomLocationState | null)?.activeSection;
    if (raw === undefined) return;
    let normalized = raw === 'activities' || raw === 'assignments' ? 'curriculum' : raw;
    if (normalized === 'outline') normalized = 'curriculum';
    if (normalized && STUDENT_SECTION_IDS.has(normalized)) {
      setActiveSection(normalized);
    }
  }, [location.key, location.state]);

  /** Show Curriculum from the top when switching to that tab (scroll was staying at end of About / long pages). */
  useEffect(() => {
    if (activeSection !== 'curriculum') return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const inset = document.querySelector('main[data-slot="sidebar-inset"]');
      if (inset instanceof HTMLElement) {
        inset.scrollTop = 0;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeSection]);

  /** Curriculum uses embedded section_resources; refetch when tab activates so it matches after teacher edits. */
  useEffect(() => {
    if (!id || activeSection !== 'curriculum') return;
    void queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(id) });
    void queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
    void queryClient.invalidateQueries({
      queryKey: assignmentKeys.classroomAssignmentLists(id),
      exact: false,
    });
  }, [activeSection, id, queryClient]);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [leaveCourseOpen, setLeaveCourseOpen] = useState(false);
  const [, setSectionVisitStack] = useState<string[]>([]);
  const openSectionIdRef = useRef<string | null>(null);
  /** When true, closing the module view (empty visit stack) returns to About instead of the outline list. */
  const sectionBackReturnsToOverviewRef = useRef(false);

  const goToSection = useCallback((id: string) => {
    const from = openSectionIdRef.current;
    if (from !== null && from !== id) {
      setSectionVisitStack((stack) => [...stack, from]);
    }
    openSectionIdRef.current = id;
    setOpenSectionId(id);
  }, []);

  const handleSectionBack = useCallback(() => {
    setSectionVisitStack((stack) => {
      if (stack.length === 0) {
        openSectionIdRef.current = null;
        setOpenSectionId(null);
        if (sectionBackReturnsToOverviewRef.current) {
          sectionBackReturnsToOverviewRef.current = false;
          setActiveSection('overview');
        }
        return stack;
      }
      const prevId = stack[stack.length - 1];
      const next = stack.slice(0, -1);
      openSectionIdRef.current = prevId;
      setOpenSectionId(prevId);
      return next;
    });
  }, []);

  const handleClassroomSectionChange = useCallback((section: string) => {
    if (section !== 'curriculum') {
      openSectionIdRef.current = null;
      setOpenSectionId(null);
      setSectionVisitStack([]);
    }
    if (section === 'overview') {
      sectionBackReturnsToOverviewRef.current = false;
    }
    setActiveSection(section);
  }, []);

  const classroom = rawClassroom as unknown as Classroom | null;

  const unenrollMutation = useUnenrollFromClassroom();

  const confirmLeaveCourse = useCallback(async () => {
    if (!id) return;
    try {
      await unenrollMutation.mutateAsync(id);
      setLeaveCourseOpen(false);
      navigate(ROUTES.STUDENT_DASHBOARD);
    } catch {
      toast.error(t('studentClassroom.leaveCourse.error'));
    }
  }, [id, navigate, t, unenrollMutation]);

  const studyCtaLabelStart = t('studentClassroom.studyCta.start');
  const studyCtaLabelContinueCourse = t('studentClassroom.studyCta.continueCourse');
  const studyCtaLabelReview = t('studentClassroom.studyCta.review');

  const resumeHit = useMemo(() => {
    if (!hasPublishedSyllabus || !syllabus?.sections?.length || !user?.id) return null;
    return resolveStudentResumeTargetWithSection({
      sections: syllabus.sections,
      releaseMode: syllabus.release_mode || 'all_at_once',
      studentProgressMap,
      flowBulk: moduleFlowBulk,
      resourceMap: syllabus.section_resources ?? {},
      assignments: rawAssignments as AssignmentRow[],
      flowCtx,
    });
  }, [
    hasPublishedSyllabus,
    syllabus,
    user?.id,
    studentProgressMap,
    moduleFlowBulk,
    flowCtx,
    rawAssignments,
  ]);

  const aboutCtaDisplay = useMemo(() => {
    const fallbackNoCta = !hasPublishedSyllabus || !syllabus?.sections?.length;
    if (fallbackNoCta) {
      return {
        primary: studyCtaLabelStart,
        secondary: null as string | null,
        headlineVariant: 'start' as const,
      };
    }
    if (!syllabus) {
      return {
        primary: studyCtaLabelStart,
        secondary: null as string | null,
        headlineVariant: 'start' as const,
      };
    }
    if (resumeHit) {
      const sec = syllabus.sections.find((s) => s.id === resumeHit.sectionId);
      const unitTitle = sec?.title?.trim() ?? '';
      if (resumeHit.target.kind === 'assignment') {
        const a = (rawAssignments as AssignmentRow[]).find((x) => x.id === resumeHit.target.id);
        const stepTitle = a?.title?.trim() || t('studentClassroom.activities.assignment');
        const secondary =
          unitTitle && stepTitle ? `${unitTitle} - ${stepTitle}` : unitTitle || stepTitle || null;
        return {
          primary: studyCtaLabelContinueCourse,
          secondary,
          headlineVariant: 'continue' as const,
        };
      }
      const r = syllabus.section_resources?.[resumeHit.sectionId]?.find(
        (x) => x.id === resumeHit.target.id
      );
      const stepTitle = r?.title?.trim() || t('studentClassroom.activities.activity');
      const secondary =
        unitTitle && stepTitle ? `${unitTitle} - ${stepTitle}` : unitTitle || stepTitle || null;
      return {
        primary: studyCtaLabelContinueCourse,
        secondary,
        headlineVariant: 'continue' as const,
      };
    }
    /** Unlock-aware resume exhausted, but syllabus still has incomplete steps (typically behind gates). */
    if (
      user?.id &&
      findFirstIncompleteDisplayedFlowAcrossCourse({
        sections: syllabus.sections,
        flowBulk: moduleFlowBulk,
        resourceMap: syllabus.section_resources ?? {},
        assignments: rawAssignments as AssignmentRow[],
        flowCtx,
      })
    ) {
      return {
        primary: t('studentClassroom.studyCta.viewCurriculum'),
        secondary: t('studentClassroom.resumeCard.viewCurriculumSubtext'),
        headlineVariant: 'viewCurriculum' as const,
      };
    }
    const { variant: syllabusVariant } = getStudyCtaTarget(
      syllabus.sections,
      syllabus.release_mode || 'all_at_once',
      studentProgressMap
    );
    const flowEngaged =
      Object.values(flowCtx.assignmentDoneMap).some(Boolean) ||
      Object.values(flowCtx.progressByStep).some(Boolean);
    let variant = syllabusVariant;
    if (variant === 'start' && flowEngaged) {
      variant = 'continue';
    }
    const primary =
      variant === 'start'
        ? studyCtaLabelStart
        : variant === 'continue'
          ? studyCtaLabelContinueCourse
          : studyCtaLabelReview;
    return {
      primary,
      secondary: t('classroomDetail.curriculum.tabTitle'),
      headlineVariant: variant,
    };
  }, [
    hasPublishedSyllabus,
    syllabus,
    resumeHit,
    rawAssignments,
    studentProgressMap,
    flowCtx,
    studyCtaLabelStart,
    studyCtaLabelContinueCourse,
    studyCtaLabelReview,
    t,
    user?.id,
    moduleFlowBulk,
    flowCtx,
  ]);

  /** About donut: aggregate all modules; unlock rules only affect Continue navigation, not this metric. */
  const aboutCourseProgress = useMemo(() => {
    if (!hasPublishedSyllabus || !syllabus?.sections?.length) {
      return { done: 0, total: 0, percent: 0 };
    }
    return aggregateCurriculumStepProgress({
      sections: syllabus.sections,
      flowBulk: moduleFlowBulk,
      sectionResources: syllabus.section_resources ?? {},
      linkedAssignmentsMap,
      assignments: rawAssignments as AssignmentRow[],
      flowCtx,
    });
  }, [
    hasPublishedSyllabus,
    syllabus?.sections,
    syllabus?.section_resources,
    moduleFlowBulk,
    linkedAssignmentsMap,
    rawAssignments,
    flowCtx,
  ]);

  const handleStudyCtaClick = useCallback(() => {
    if (!syllabus || syllabus.status !== 'published') {
      const list = [
        ...(rawAssignments as {
          id: string;
          due_at?: string | null;
          submissions?: { status?: string }[];
        }[]),
      ];
      list.sort((a, b) => {
        const aDone =
          Array.isArray(a.submissions) && a.submissions.some((s) => s.status === 'completed');
        const bDone =
          Array.isArray(b.submissions) && b.submissions.some((s) => s.status === 'completed');
        if (aDone !== bDone) return aDone ? 1 : -1;
        const at = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
        const bt = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
        if (at !== bt) return at - bt;
        return 0;
      });
      const nextId = list[0]?.id;
      if (nextId) {
        navigate(`/student/assignment/${nextId}`, {
          state: { returnClassroomSection: 'overview' },
        });
        return;
      }
      toast.info(t('studentClassroom.noAssignmentsDesc'));
      return;
    }
    if (user?.id && syllabus.sections?.length) {
      const target = resolveStudentResumeTarget({
        sections: syllabus.sections,
        releaseMode: syllabus.release_mode || 'all_at_once',
        studentProgressMap,
        flowBulk: moduleFlowBulk,
        resourceMap: syllabus.section_resources ?? {},
        assignments: rawAssignments as AssignmentRow[],
        flowCtx,
      });
      if (target) {
        if (target.kind === 'resource') {
          navigate(`/student/classroom/${id}/activity/${target.id}`, {
            state: { returnClassroomSection: 'curriculum' },
          });
        } else {
          navigate(`/student/assignment/${target.id}`, {
            state: { returnClassroomSection: 'curriculum' },
          });
        }
        return;
      }
    }
    sectionBackReturnsToOverviewRef.current = false;
    openSectionIdRef.current = null;
    setOpenSectionId(null);
    setSectionVisitStack([]);
    setActiveSection('curriculum');
  }, [
    id,
    moduleFlowBulk,
    navigate,
    rawAssignments,
    studentProgressMap,
    syllabus,
    t,
    user?.id,
    flowCtx,
  ]);

  /** While syllabus is loading we keep 2 nav slots (curriculum disabled) so the sidebar does not jump. */
  const showSyllabusNavSlots = syllabusLoading || hasPublishedSyllabus;

  const classroomSections = useMemo(() => {
    const overview = { id: 'overview' as const, title: t('studentClassroom.about'), icon: Info };
    if (!showSyllabusNavSlots) return [overview];
    return [
      overview,
      {
        id: 'curriculum' as const,
        title: t('classroomDetail.curriculum.tabTitle'),
        icon: LayoutList,
        disabled: syllabusLoading,
      },
    ];
  }, [t, syllabusLoading, showSyllabusNavSlots]);

  if (!id || !classroom) return null;

  return (
    <ClassroomLayout
      classroomName={classroom.name}
      classroomSubject={classroom.subject}
      activeSection={activeSection}
      onSectionChange={handleClassroomSectionChange}
      customSections={classroomSections}
      hideGlobalNav
    >
      <div className="space-y-6 md:space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-6 pt-6 md:pt-10">
            <div className="grid md:grid-cols-3 gap-x-6 gap-y-6 md:items-start md:gap-x-6 md:gap-y-10">
              <h2
                className={cn(
                  'order-1 text-2xl md:text-3xl font-bold text-foreground md:col-span-3 self-start',
                  isRTL ? 'text-right' : 'text-left',
                )}
              >
                {classroom.name}
              </h2>

              <Card
                className="order-3 max-md:order-3 md:col-span-2 md:row-start-2 flex min-h-0 flex-col border border-border shadow-sm rounded-xl bg-card overflow-hidden pt-2 pb-6 h-full"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <CardContent className="flex flex-1 flex-col pt-6">
                  {classroom.resources && (
                    <div className="min-w-0 shrink-0">
                      <h3
                        className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {t('classroomDetail.overview.about')}
                      </h3>
                      <SafeMathMarkdown
                        content={classroom.resources}
                        className={`min-w-0 text-foreground/80 [overflow-wrap:anywhere] ${isRTL ? 'text-right' : 'text-left'}`}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <div
                className={cn(
                  'max-md:contents md:col-start-3 md:row-start-2 md:flex md:w-full md:min-w-0 md:flex-col md:gap-3',
                )}
              >
                <div className="order-2 max-md:order-2 w-full">
                  {syllabusLoading || !aboutResumeTargetsReady ? (
                    <div
                      className="w-full rounded-xl border border-border bg-card shadow-sm p-4 sm:p-5 animate-pulse"
                      aria-hidden
                    >
                      <div
                        className={cn(
                          'flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5',
                          isRTL && 'sm:flex-row-reverse',
                        )}
                      >
                        <div className="h-[76px] w-[76px] shrink-0 rounded-full bg-muted" />
                        <div className="flex-1 space-y-3 min-w-0">
                          <div className="h-10 w-full rounded-md bg-muted" />
                          <div className="h-11 w-full rounded-md bg-muted sm:max-w-[11rem]" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <CourseResumeProgressCard
                      percent={aboutCourseProgress.percent}
                      headlinePrefix={t(
                        `studentClassroom.resumeCard.headline.${aboutCtaDisplay.headlineVariant}`,
                      )}
                      headlineHighlight={aboutCtaDisplay.secondary}
                      buttonLabel={aboutCtaDisplay.primary}
                      onContinue={handleStudyCtaClick}
                      isRTL={isRTL}
                      ariaLabel={t('studentClassroom.resumeCard.aria', {
                        percent: aboutCourseProgress.percent,
                        action: aboutCtaDisplay.primary,
                        detail:
                          aboutCtaDisplay.secondary?.trim() ||
                          t('studentClassroom.resumeCard.detailFallback'),
                      })}
                      className="max-w-none"
                      buttonClassName="w-full sm:w-full"
                    />
                  )}
                </div>

                <Card
                  className="order-4 max-md:order-4 w-full border border-border shadow-sm rounded-xl bg-card overflow-hidden"
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <CardContent className="flex flex-col p-3 sm:p-4">
                    {teacherId ? (
                      <div
                        className={cn(
                          'flex min-h-[2.5rem] items-center gap-3',
                          (classroom.start_date || classroom.end_date) && 'pb-4',
                          isRTL && 'flex-row-reverse',
                        )}
                      >
                        {teacherLoading ? (
                          <div
                            className="flex w-full animate-pulse items-center gap-3"
                            aria-hidden
                          >
                            <div className="h-11 w-11 shrink-0 rounded-full bg-muted border border-border/60" />
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="h-5 w-40 max-w-full rounded bg-muted" />
                              <div className="h-2.5 w-14 rounded bg-muted" />
                            </div>
                          </div>
                        ) : teacher ? (
                          <>
                            <div className="h-11 w-11 shrink-0 rounded-full bg-muted border border-border overflow-hidden">
                              {teacher.avatar_url ? (
                                <img
                                  src={teacher.avatar_url}
                                  alt={teacher.full_name ?? ''}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-muted-foreground font-semibold text-sm">
                                  {teacher.full_name?.charAt(0) || 'T'}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 self-center">
                              <p className="text-lg font-semibold leading-snug text-foreground [overflow-wrap:anywhere] sm:text-xl">
                                {teacher.full_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {t('common.teacher')}
                              </p>
                            </div>
                          </>
                        ) : (
                          <p className="flex-1 text-xs text-muted-foreground">
                            {teacherError ? t('common.error') : '—'}
                          </p>
                        )}
                      </div>
                    ) : null}

                    {(classroom.start_date || classroom.end_date) && (
                      <>
                        {teacherId ? (
                          <div
                            className="-mx-3 border-t border-border sm:-mx-4"
                            role="separator"
                            aria-hidden
                          />
                        ) : null}
                        <p
                          className={cn(
                            'text-sm font-medium leading-snug text-foreground sm:text-base tabular-nums [overflow-wrap:anywhere]',
                            teacherId ? 'pt-4' : 'pt-0',
                            isRTL ? 'text-right' : 'text-left',
                          )}
                        >
                          <span className="text-muted-foreground">
                            {t('studentClassroom.duration')}:{' '}
                          </span>
                          <span className="text-foreground">
                            {classroom.start_date
                              ? new Date(classroom.start_date).toLocaleDateString()
                              : '\u2014'}
                            {' - '}
                            {classroom.end_date
                              ? new Date(classroom.end_date).toLocaleDateString()
                              : '\u2014'}
                          </span>
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="order-5 max-md:order-5 flex w-full flex-col gap-3">
                {classroom.learning_outcomes && classroom.learning_outcomes.length > 0 && (
                  <Card
                    className="border border-border shadow-sm rounded-xl bg-card overflow-hidden"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <CardHeader className="pb-3 border-b border-border bg-transparent">
                      <CardTitle
                        className={`text-base flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center text-success">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        {t('studentClassroom.learningOutcomes')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ul className="space-y-2">
                        {classroom.learning_outcomes.map((outcome, index) => (
                          <li
                            key={index}
                            className={`flex items-start gap-2 text-sm text-foreground/80 ${isRTL ? 'text-right' : 'text-left'}`}
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                            <span>{outcome}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {classroom.key_challenges && classroom.key_challenges.length > 0 && (
                  <Card
                    className="border border-border shadow-sm rounded-xl bg-card overflow-hidden"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <CardHeader className="pb-3 border-b border-border bg-transparent">
                      <CardTitle
                        className={`text-base flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center text-warning">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        {t('studentClassroom.keyChallenges')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ul className="space-y-2">
                        {classroom.key_challenges.map((challenge, index) => (
                          <li
                            key={index}
                            className={`flex items-start gap-2 text-sm text-foreground/80 ${isRTL ? 'text-right' : 'text-left'}`}
                          >
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                            <span>{challenge}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                </div>
              </div>
            </div>

            <div className="flex w-full justify-end">
              <Button
                type="button"
                variant="outline"
                size="default"
                className={cn(
                  'gap-2 rounded-full border-destructive/40 bg-background/95 text-destructive shadow-md backdrop-blur-sm',
                  'hover:bg-destructive/10 focus-visible:ring-destructive/30'
                )}
                onClick={() => setLeaveCourseOpen(true)}
                aria-label={t('studentClassroom.leaveCourse.button')}
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                {t('studentClassroom.leaveCourse.button')}
              </Button>
            </div>
          </div>
        )}

        {activeSection === 'curriculum' && hasPublishedSyllabus && (
          <div className="space-y-6">
            {openSectionId ? (
              <SectionContentPage
                sectionId={openSectionId}
                classroomId={id}
                moduleFlowSteps={moduleFlowBulk[openSectionId] ?? []}
                sections={syllabus.sections}
                sectionResources={syllabus.section_resources || {}}
                linkedAssignmentsMap={linkedAssignmentsMap}
                syllabusId={syllabus.id}
                releaseMode={syllabus.release_mode || 'all_at_once'}
                studentProgressMap={studentProgressMap}
                sequentialUnlockFlow={sequentialUnlockFlow}
                isRTL={isRTL}
                onBack={handleSectionBack}
                onNavigateSection={goToSection}
              />
            ) : (
              <>
                <GradingBreakdownView categories={syllabus.grading_categories} isRTL={isRTL} />
                <StudentActivitiesSection
                  classroomId={id}
                  isRTL={isRTL}
                  resumeTarget={resumeHit?.target ?? null}
                  resumeSectionId={resumeHit?.sectionId ?? null}
                  onOpenModuleFullPage={(sectionId) => {
                    sectionBackReturnsToOverviewRef.current = false;
                    goToSection(sectionId);
                  }}
                />
                <StudentPoliciesView policies={syllabus.policies ?? []} isRTL={isRTL} />
              </>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={leaveCourseOpen} onOpenChange={setLeaveCourseOpen}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="rounded-xl">
          <AlertDialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <AlertDialogTitle>{t('studentClassroom.leaveCourse.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('studentClassroom.leaveCourse.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRTL ? 'flex-row-reverse sm:space-x-reverse' : ''}>
            <AlertDialogCancel className="mt-0" disabled={unenrollMutation.isPending}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmLeaveCourse();
              }}
              disabled={unenrollMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unenrollMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                t('studentClassroom.leaveCourse.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClassroomLayout>
  );
};

export default StudentClassroomDetail;
