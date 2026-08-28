import { useQueryClient } from '@tanstack/react-query';
import { Info, LayoutList, Loader2 } from 'lucide-react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Assignment } from '@/types';
import type { ClassroomLocationState } from '@/types/navigation';
import type { StudentProgressStatus } from '@/types/syllabus';
import { ClassroomLayout } from '@/components/layouts';
import { StudentClassroomOverviewSection } from '@/components/features/classroom/StudentClassroomOverviewSection';
import { StudentClassroomCurriculumSection } from '@/components/features/classroom/StudentClassroomCurriculumSection';
import { StudentLeaveCourseDialog } from '@/components/features/classroom/StudentLeaveCourseDialog';
import { ROUTES } from '@/config/routes';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import {
  useClassroomAssignments,
  useTeacherProfile,
  useSyllabus,
  useStudentProgress,
} from '@/hooks/queries';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import {
  useModuleFlowStepsBulk,
  useStudentCurriculumFlowContext,
  moduleFlowKeys,
} from '@/hooks/queries/useModuleFlowQueries';
import { syllabusKeys } from '@/hooks/queries/useSyllabusQueries';
import { aggregateCurriculumStepProgress } from '@/lib/curriculumStepProgress';
import type { StudentClassroomDetailView } from '@/lib/classroomDetail';
import { linkedAssignmentsVisibleInModuleFlow, type AssignmentRow } from '@/lib/moduleFlow';
import {
  findFirstIncompleteDisplayedFlowAcrossCourse,
  resolveStudentResumeTarget,
  resolveStudentResumeTargetWithSection,
} from '@/lib/resolveStudentResumeTarget';
import type { SectionSequentialUnlockFlow } from '@/lib/sectionUnlock';
import { getStudyCtaTarget } from '@/lib/studyCtaTarget';

const STUDENT_SECTION_IDS = new Set(['overview', 'curriculum']);

type StudentClassroomDetailContentProps = {
  classroomId: string;
  classroom: StudentClassroomDetailView;
};

export function StudentClassroomDetailContent({
  classroomId,
  classroom,
}: StudentClassroomDetailContentProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isRTL } = useLanguage();

  const { data: rawAssignments = [] } = useClassroomAssignments(classroomId);

  const teacherId = classroom.teacher_id;
  const {
    data: teacher,
    isLoading: teacherLoading,
    isError: teacherError,
  } = useTeacherProfile(teacherId);
  const { data: syllabus, isLoading: syllabusLoading } = useSyllabus(classroomId);
  const hasPublishedSyllabus = Boolean(syllabus && syllabus.status === 'published');
  const { data: studentProgressData, isPending: studentProgressPending } = useStudentProgress(
    syllabus?.id,
    user?.id,
  );

  const syllabusSectionIds = useMemo(
    () => (syllabus?.sections ? [...syllabus.sections].map((s) => s.id) : []),
    [syllabus?.sections],
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

  const aboutResumeTargetsReady =
    !hasPublishedSyllabus ||
    !user?.id ||
    (!curriculumFlowProgressLoading &&
      !(syllabusSectionIds.length > 0 && moduleFlowBulkPending) &&
      !studentProgressPending);

  const curriculumOverviewLoading =
    hasPublishedSyllabus &&
    Boolean(user?.id) &&
    (curriculumFlowProgressLoading ||
      (syllabusSectionIds.length > 0 && moduleFlowBulkPending) ||
      studentProgressPending);

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

  useEffect(() => {
    const raw = (location.state as ClassroomLocationState | null)?.activeSection;
    if (raw === undefined) return;
    let normalized = raw === 'activities' || raw === 'assignments' ? 'curriculum' : raw;
    if (normalized === 'outline') normalized = 'curriculum';
    if (normalized && STUDENT_SECTION_IDS.has(normalized)) {
      setActiveSection(normalized);
    }
  }, [location.key, location.state]);

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

  useEffect(() => {
    if (activeSection !== 'curriculum') return;
    void queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    void queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
    void queryClient.invalidateQueries({
      queryKey: assignmentKeys.classroomAssignmentLists(classroomId),
      exact: false,
    });
  }, [activeSection, classroomId, queryClient]);

  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [leaveCourseOpen, setLeaveCourseOpen] = useState(false);
  const [, setSectionVisitStack] = useState<string[]>([]);
  const openSectionIdRef = useRef<string | null>(null);
  const sectionBackReturnsToOverviewRef = useRef(false);

  const goToSection = useCallback((sectionId: string) => {
    const from = openSectionIdRef.current;
    if (from !== null && from !== sectionId) {
      setSectionVisitStack((stack) => [...stack, from]);
    }
    openSectionIdRef.current = sectionId;
    setOpenSectionId(sectionId);
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
        unitTitle: null as string | null,
        stepTitle: null as string | null,
        headlineVariant: 'start' as const,
      };
    }
    if (!syllabus) {
      return {
        primary: studyCtaLabelStart,
        secondary: null as string | null,
        unitTitle: null as string | null,
        stepTitle: null as string | null,
        headlineVariant: 'start' as const,
      };
    }
    if (resumeHit) {
      const sec = syllabus.sections.find((s) => s.id === resumeHit.sectionId);
      const unitTitle = sec?.title?.trim() ?? '';
      if (resumeHit.target.kind === 'assignment') {
        const a = rawAssignments.find((x) => x.id === resumeHit.target.id);
        const stepTitle = a?.title?.trim() || t('studentClassroom.activities.assignment');
        const secondary =
          unitTitle && stepTitle ? `${unitTitle} - ${stepTitle}` : unitTitle || stepTitle || null;
        return {
          primary: studyCtaLabelContinueCourse,
          secondary,
          unitTitle: unitTitle || null,
          stepTitle: stepTitle || null,
          headlineVariant: 'continue' as const,
        };
      }
      const r = syllabus.section_resources?.[resumeHit.sectionId]?.find(
        (x) => x.id === resumeHit.target.id,
      );
      const stepTitle = r?.title?.trim() || t('studentClassroom.activities.activity');
      const secondary =
        unitTitle && stepTitle ? `${unitTitle} - ${stepTitle}` : unitTitle || stepTitle || null;
      return {
        primary: studyCtaLabelContinueCourse,
        secondary,
        unitTitle: unitTitle || null,
        stepTitle: stepTitle || null,
        headlineVariant: 'continue' as const,
      };
    }
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
        unitTitle: null as string | null,
        stepTitle: null as string | null,
        headlineVariant: 'viewCurriculum' as const,
      };
    }
    const { variant: syllabusVariant } = getStudyCtaTarget(
      syllabus.sections,
      syllabus.release_mode || 'all_at_once',
      studentProgressMap,
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
      unitTitle: null as string | null,
      stepTitle: null as string | null,
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
  ]);

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
          navigate(`/student/classroom/${classroomId}/activity/${target.id}`, {
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
    classroomId,
    moduleFlowBulk,
    navigate,
    rawAssignments,
    studentProgressMap,
    syllabus,
    t,
    user?.id,
    flowCtx,
  ]);

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
        {activeSection === 'overview' && (
          <StudentClassroomOverviewSection
            classroom={classroom}
            isRTL={isRTL}
            teacherId={teacherId}
            teacher={teacher}
            teacherLoading={teacherLoading}
            teacherError={teacherError}
            syllabusLoading={syllabusLoading}
            aboutResumeTargetsReady={aboutResumeTargetsReady}
            aboutCourseProgress={aboutCourseProgress}
            aboutCtaDisplay={aboutCtaDisplay}
            onStudyCtaClick={handleStudyCtaClick}
            onLeaveCourse={() => setLeaveCourseOpen(true)}
          />
        )}

        {activeSection === 'curriculum' && (syllabusLoading || !syllabus || !hasPublishedSyllabus) && (
          <div className="flex min-h-[40vh] items-center justify-center py-20">
            <Loader2
              className="h-8 w-8 animate-spin text-muted-foreground"
              aria-label={t('common.loading')}
            />
          </div>
        )}

        {activeSection === 'curriculum' && hasPublishedSyllabus && syllabus && (
          <StudentClassroomCurriculumSection
            classroomId={classroomId}
            isRTL={isRTL}
            syllabus={syllabus}
            openSectionId={openSectionId}
            moduleFlowBulk={moduleFlowBulk}
            linkedAssignmentsMap={linkedAssignmentsMap}
            studentProgressMap={studentProgressMap}
            sequentialUnlockFlow={sequentialUnlockFlow}
            resumeTarget={resumeHit?.target ?? null}
            resumeSectionId={resumeHit?.sectionId ?? null}
            curriculumOverviewLoading={curriculumOverviewLoading}
            onBack={handleSectionBack}
            onNavigateSection={goToSection}
            onOpenModuleFullPage={(sectionId) => {
              sectionBackReturnsToOverviewRef.current = false;
              goToSection(sectionId);
            }}
          />
        )}
      </div>

      <StudentLeaveCourseDialog
        classroomId={classroomId}
        open={leaveCourseOpen}
        onOpenChange={setLeaveCourseOpen}
        isRTL={isRTL}
        onLeft={() => navigate(ROUTES.STUDENT_DASHBOARD)}
      />
    </ClassroomLayout>
  );
}
