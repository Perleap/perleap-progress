import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  Users,
  Map,
  LayoutList,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation } from 'react-router-dom';
import type { ClassroomLocationState } from '@/types/navigation';
import type { StudentProgressStatus } from '@/types/syllabus';
import { GradingBreakdownView } from '@/components/features/syllabus/GradingBreakdownView';
import { ModuleSyllabusAccordion } from '@/components/features/syllabus/ModuleSyllabusAccordion';
import { SectionContentPage } from '@/components/features/syllabus/SectionContentPage';
import { StudentActivitiesSection } from '@/components/features/syllabus/StudentActivitiesSection';
import { StudentPoliciesView } from '@/components/features/syllabus/StudentPoliciesView';
import { ClassroomLayout } from '@/components/layouts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useClassroom,
  useClassroomAssignments,
  useTeacherProfile,
  useSyllabus,
  useStudentProgress,
} from '@/hooks/queries';
import { assignmentKeys } from '@/hooks/queries/useAssignmentQueries';
import { useModuleFlowStepsBulk, moduleFlowKeys } from '@/hooks/queries/useModuleFlowQueries';
import { syllabusKeys } from '@/hooks/queries/useSyllabusQueries';
import { linkedAssignmentsVisibleInModuleFlow } from '@/lib/moduleFlow';
import { formatCourseDuration } from '@/lib/dateUtils';
import { getStudyCtaTarget } from '@/lib/studyCtaTarget';
import { cn } from '@/lib/utils';

const STUDENT_SECTION_IDS = new Set(['overview', 'outline', 'curriculum']);

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
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { data: rawClassroom } = useClassroom(id);
  const { data: rawAssignments = [] } = useClassroomAssignments(id);

  const teacherId = rawClassroom?.teacher_id;
  const { data: teacher, isLoading: teacherLoading, isError: teacherError } = useTeacherProfile(teacherId);
  const { data: syllabus, isLoading: syllabusLoading } = useSyllabus(id);
  const { data: studentProgressData } = useStudentProgress(syllabus?.id, user?.id);

  const syllabusSectionIds = useMemo(
    () => (syllabus?.sections ? [...syllabus.sections].map((s) => s.id) : []),
    [syllabus?.sections],
  );
  const { data: moduleFlowBulk = {} } = useModuleFlowStepsBulk(syllabusSectionIds);

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
    (rawAssignments as any[]).forEach((a: any) => {
      if (a.syllabus_section_id) {
        if (!map[a.syllabus_section_id]) map[a.syllabus_section_id] = [];
        map[a.syllabus_section_id].push({
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
    const normalized = raw === 'activities' || raw === 'assignments' ? 'curriculum' : raw;
    return normalized && STUDENT_SECTION_IDS.has(normalized) ? normalized : 'overview';
  });

  /** Course Outline uses embedded section_resources from getSyllabusByClassroom; refetch when tab activates so it matches Curriculum after teacher edits. */
  useEffect(() => {
    if (!id || activeSection !== 'outline') return;
    void queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(id) });
    void queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.listByClassroom(id) });
  }, [activeSection, id, queryClient]);
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [sectionVisitStack, setSectionVisitStack] = useState<string[]>([]);
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
      const next = [...stack];
      const prevId = next.pop()!;
      openSectionIdRef.current = prevId;
      setOpenSectionId(prevId);
      return next;
    });
  }, []);

  /** About CTA: open outline and deep-link to first module (syllabus start). */
  const goToStudyOutlineFromAbout = useCallback(
    (previousSection: string) => {
      if (!syllabus || syllabus.status !== 'published') {
        sectionBackReturnsToOverviewRef.current = false;
        setActiveSection('overview');
        return;
      }
      const { targetSectionId } = getStudyCtaTarget(
        syllabus.sections,
        syllabus.release_mode || 'all_at_once',
        studentProgressMap,
        { aboutPrimaryCta: true }
      );
      sectionBackReturnsToOverviewRef.current = previousSection === 'overview';
      setActiveSection('outline');
      if (targetSectionId) goToSection(targetSectionId);
    },
    [syllabus, studentProgressMap, goToSection]
  );

  const handleStudyCtaClick = useCallback(() => {
    goToStudyOutlineFromAbout(activeSection);
  }, [goToStudyOutlineFromAbout, activeSection]);

  const handleClassroomSectionChange = useCallback((section: string) => {
    if (section === 'outline') {
      sectionBackReturnsToOverviewRef.current = false;
      openSectionIdRef.current = null;
      setOpenSectionId(null);
      setSectionVisitStack([]);
      setActiveSection('outline');
      return;
    }
    setActiveSection(section);
  }, []);

  const classroom = rawClassroom as unknown as Classroom | null;

  const hasPublishedSyllabus = syllabus && syllabus.status === 'published';

  const studyCtaLabelStart = t('studentClassroom.studyCta.start');
  const studyCtaLabelView = t('studentClassroom.studyCta.viewAssignments');

  const aboutPrimaryButtonLabel = hasPublishedSyllabus ? studyCtaLabelStart : studyCtaLabelView;

  /** While syllabus is loading we keep 3 nav slots (outline/curriculum disabled) so the sidebar does not jump 1→3 when data arrives. */
  const showSyllabusNavSlots = syllabusLoading || hasPublishedSyllabus;

  const classroomSections = useMemo(() => {
    const overview = { id: 'overview' as const, title: t('studentClassroom.about'), icon: Info };
    if (!showSyllabusNavSlots) return [overview];
    return [
      overview,
      {
        id: 'outline' as const,
        title: t('syllabus.courseOutline'),
        icon: Map,
        disabled: syllabusLoading,
      },
      {
        id: 'curriculum' as const,
        title: t('classroomDetail.curriculum.tabTitle'),
        icon: LayoutList,
        disabled: syllabusLoading,
      },
    ];
  }, [t, syllabusLoading, showSyllabusNavSlots]);

  if (!classroom) return null;

  return (
    <ClassroomLayout
      classroomName={classroom.name}
      classroomSubject={classroom.subject}
      activeSection={activeSection}
      onSectionChange={handleClassroomSectionChange}
      customSections={classroomSections}
    >
      <div className="space-y-6 md:space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <h2
              className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('studentClassroom.about')}
            </h2>

            <div className="grid md:grid-cols-3 gap-6 md:items-start">
              {/* Main Info Card */}
              <Card
                className="md:col-span-2 flex min-h-0 flex-col border border-border shadow-sm rounded-xl bg-card overflow-hidden pt-2 pb-6 h-full"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <CardHeader className="shrink-0 border-b border-border bg-transparent pt-0">
                  <CardTitle className={`text-xl ${isRTL ? 'text-right' : 'text-left'}`}>
                    {classroom.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col pt-6">
                  {classroom.resources && (
                    <div className="min-w-0 shrink-0">
                      <h3
                        className={`text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {t('classroomDetail.overview.about')}
                      </h3>
                      <div
                        className={`text-foreground/80 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {classroom.resources}
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      'mt-auto flex w-full justify-center',
                      classroom.resources && 'border-t border-border/60 pt-6'
                    )}
                  >
                    {syllabusLoading ? (
                      <div
                        className="h-[4.5rem] w-full max-w-md rounded-xl bg-muted/70 animate-pulse"
                        aria-hidden
                      />
                    ) : (
                      <Button
                        type="button"
                        size="lg"
                        className="min-h-[4.5rem] gap-3 px-10 py-6 text-xl [&_svg]:!size-7"
                        onClick={handleStudyCtaClick}
                      >
                        <span className="inline-grid min-w-0 place-items-center">
                          <span
                            className="col-start-1 row-start-1 invisible whitespace-nowrap pointer-events-none select-none"
                            aria-hidden
                          >
                            {studyCtaLabelStart}
                          </span>
                          <span
                            className="col-start-1 row-start-1 invisible whitespace-nowrap pointer-events-none select-none"
                            aria-hidden
                          >
                            {studyCtaLabelView}
                          </span>
                          <span className="col-start-1 row-start-1 whitespace-nowrap">
                            {aboutPrimaryButtonLabel}
                          </span>
                        </span>
                        <ArrowRight className={cn('shrink-0', isRTL && 'rotate-180')} />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Sidebar Info — always reserve teacher card height so async profile load does not reflow main-column text */}
              <div className="space-y-6">
                {teacherId && (
                  <Card
                    className="border border-border shadow-sm rounded-xl bg-card overflow-hidden"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <CardHeader className="pb-3 border-b border-border bg-transparent">
                      <CardTitle
                        className={`text-base flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center">
                          <Users className="h-4 w-4 text-foreground" />
                        </div>
                        {t('common.teacher')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {teacherLoading ? (
                        <div className="flex animate-pulse items-center gap-4" aria-hidden>
                          <div className="h-12 w-12 shrink-0 rounded-full bg-muted border-2 border-background shadow-sm" />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="h-4 w-36 max-w-full rounded bg-muted" />
                            <div className="h-3 w-20 rounded bg-muted" />
                          </div>
                        </div>
                      ) : teacher ? (
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-muted border-2 border-background shadow-sm overflow-hidden">
                            {teacher.avatar_url ? (
                              <img
                                src={teacher.avatar_url}
                                alt={teacher.full_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground font-medium text-lg">
                                {teacher.full_name?.charAt(0) || 'T'}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-base text-foreground truncate">{teacher.full_name}</p>
                            <p className="text-xs text-muted-foreground">{t('common.teacher')}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {teacherError ? t('common.error') : '—'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card
                  className="border border-border shadow-sm rounded-xl bg-card overflow-hidden"
                  dir={isRTL ? 'rtl' : 'ltr'}
                >
                  <CardHeader className="pb-3 border-b border-border bg-transparent">
                    <CardTitle
                      className={`text-base flex items-center gap-2 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <div className="h-7 w-7 rounded-lg bg-background border border-border flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-foreground" />
                      </div>
                      {t('studentClassroom.schedule')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {formatCourseDuration(classroom.start_date, classroom.end_date) && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                            {t('studentClassroom.duration')}
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {formatCourseDuration(classroom.start_date, classroom.end_date)}
                          </p>
                        </div>
                      </div>
                    )}

                    {(classroom.start_date || classroom.end_date) && (
                      <div className="space-y-3 pt-2 border-t border-border/50">
                        {classroom.start_date && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground font-medium">
                              {t('studentClassroom.startDate')}
                            </span>
                            <Badge
                              variant="outline"
                              className="bg-muted/50 text-foreground border-border/50 font-mono text-[10px]"
                            >
                              {new Date(classroom.start_date).toLocaleDateString()}
                            </Badge>
                          </div>
                        )}
                        {classroom.end_date && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground font-medium">
                              {t('studentClassroom.endDate')}
                            </span>
                            <Badge
                              variant="outline"
                              className="bg-muted/50 text-foreground border-border/50 font-mono text-[10px]"
                            >
                              {new Date(classroom.end_date).toLocaleDateString()}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

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
        )}

        {/* Course Outline Section (Student — read-only) */}
        {activeSection === 'outline' &&
          hasPublishedSyllabus &&
          (openSectionId ? (
            <SectionContentPage
              sectionId={openSectionId}
              classroomId={id!}
              moduleFlowSteps={moduleFlowBulk[openSectionId] ?? []}
              sections={syllabus.sections}
              sectionResources={syllabus.section_resources || {}}
              linkedAssignmentsMap={linkedAssignmentsMap}
              syllabusId={syllabus.id}
              releaseMode={syllabus.release_mode || 'all_at_once'}
              studentProgressMap={studentProgressMap}
              isRTL={isRTL}
              onBack={handleSectionBack}
              onNavigateSection={goToSection}
            />
          ) : (
            <div className="space-y-6">
              <GradingBreakdownView categories={syllabus.grading_categories} isRTL={isRTL} />

              {syllabusLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ModuleSyllabusAccordion
                  sections={syllabus.sections}
                  sectionResources={syllabus.section_resources}
                  linkedAssignmentsMap={linkedAssignmentsMap}
                  classroomId={id!}
                  structureType={syllabus.structure_type}
                  releaseMode={syllabus.release_mode || 'all_at_once'}
                  mode="student"
                  isRTL={isRTL}
                  studentProgressMap={studentProgressMap}
                  onOpenModule={(sectionId) => {
                    sectionBackReturnsToOverviewRef.current = false;
                    goToSection(sectionId);
                  }}
                />
              )}

              <StudentPoliciesView policies={syllabus.policies ?? []} isRTL={isRTL} />
            </div>
          ))}

        {activeSection === 'curriculum' && hasPublishedSyllabus && (
          <StudentActivitiesSection classroomId={id!} isRTL={isRTL} />
        )}
      </div>
    </ClassroomLayout>
  );
};

export default StudentClassroomDetail;
