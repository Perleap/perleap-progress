import { CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CourseResumeProgressCard } from '@/components/features/syllabus/CourseResumeProgressCard';
import SafeMathMarkdown from '@/components/SafeMathMarkdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { StudentClassroomDetailView } from '@/lib/classroomDetail';

export type AboutCtaDisplay = {
  primary: string;
  secondary: string | null;
  unitTitle: string | null;
  stepTitle: string | null;
  headlineVariant: 'start' | 'continue' | 'review' | 'viewCurriculum';
};

export type StudentClassroomOverviewSectionProps = {
  classroom: StudentClassroomDetailView;
  isRTL: boolean;
  teacherId?: string;
  teacher?: { full_name?: string | null; avatar_url?: string | null } | null;
  teacherLoading: boolean;
  teacherError: boolean;
  syllabusLoading: boolean;
  aboutResumeTargetsReady: boolean;
  aboutCourseProgress: { done: number; total: number; percent: number };
  aboutCtaDisplay: AboutCtaDisplay;
  onStudyCtaClick: () => void;
  onLeaveCourse: () => void;
};

export function StudentClassroomOverviewSection({
  classroom,
  isRTL,
  teacherId,
  teacher,
  teacherLoading,
  teacherError,
  syllabusLoading,
  aboutResumeTargetsReady,
  aboutCourseProgress,
  aboutCtaDisplay,
  onStudyCtaClick,
  onLeaveCourse,
}: StudentClassroomOverviewSectionProps) {
  const { t } = useTranslation();

  return (
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
                headlineUnitTitle={aboutCtaDisplay.unitTitle}
                headlineStepTitle={aboutCtaDisplay.stepTitle}
                buttonLabel={aboutCtaDisplay.primary}
                onContinue={onStudyCtaClick}
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
            className="order-4 max-md:order-4 w-full border border-border shadow-sm rounded-xl bg-card overflow-hidden py-0 gap-0"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <CardContent className="flex flex-col p-3 sm:p-4">
              {teacherId ? (
                <div
                  className={cn(
                    'flex min-h-[2.5rem] items-center gap-3',
                    (classroom.start_date || classroom.end_date) && 'pb-3',
                    isRTL && 'flex-row-reverse',
                  )}
                >
                  {teacherLoading ? (
                    <div className="flex w-full animate-pulse items-center gap-3" aria-hidden>
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
                        <p className="text-[11px] text-muted-foreground">{t('common.teacher')}</p>
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
                      teacherId ? 'pt-3' : 'pt-0',
                      isRTL ? 'text-right' : 'text-left',
                    )}
                  >
                    <span className="text-muted-foreground">{t('studentClassroom.duration')}: </span>
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
            'hover:bg-destructive/10 focus-visible:ring-destructive/30',
          )}
          onClick={onLeaveCourse}
          aria-label={t('studentClassroom.leaveCourse.button')}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {t('studentClassroom.leaveCourse.button')}
        </Button>
      </div>
    </div>
  );
}
