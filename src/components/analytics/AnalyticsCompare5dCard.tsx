import { GitCompare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Compare5dResults } from '@/components/analytics/Compare5dResults';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AnalyticsModuleFilter } from '@/lib/analyticsScope';
import {
  assignmentsInCompareScope,
  buildCompare5dScopeSummary,
  compare5dModeAvailability,
  defaultCompare5dMode,
  resolveCompare5dSide,
  sideOptionsForCompare5dMode,
} from '@/lib/analyticsCompare5d/resolveCompare5dSide';
import type { Compare5dMode, Compare5dStudentRow } from '@/lib/analyticsCompare5d/types';
import type { AnalyticsAssignmentRef, AnalyticsModuleRef } from '@/lib/analyticsScope';

type Lang = 'en' | 'he';

export type AnalyticsCompare5dCardProps = {
  classroomId: string;
  modules: AnalyticsModuleRef[];
  assignments: AnalyticsAssignmentRef[];
  students: Compare5dStudentRow[];
  showUnplaced: boolean;
  structKey: string;
  analyticsLanguage: Lang;
  isRTL: boolean;
  rawSubmissions: { id: string; assignment_id: string }[];
  rawSnapshots: Compare5dStudentRow['snapshots'];
  sectionTitleResolver: (syllabusSectionId: string | null) => string;
};

export function AnalyticsCompare5dCard({
  classroomId,
  modules,
  assignments,
  students,
  showUnplaced,
  structKey,
  analyticsLanguage,
  isRTL,
  rawSubmissions,
  rawSnapshots,
  sectionTitleResolver,
}: AnalyticsCompare5dCardProps) {
  const { t } = useTranslation();

  const availability = useMemo(
    () => compare5dModeAvailability(modules, showUnplaced, students, assignments),
    [modules, showUnplaced, students, assignments],
  );

  const initialMode = defaultCompare5dMode(availability);

  const [compareMode, setCompareMode] = useState<Compare5dMode>(initialMode ?? 'sections');
  const [compareSideA, setCompareSideA] = useState('');
  const [compareSideB, setCompareSideB] = useState('');
  const [compareScopeModule, setCompareScopeModule] = useState<AnalyticsModuleFilter>('all');
  const [compareScopeAssignment, setCompareScopeAssignment] = useState<'all' | string>('all');

  useEffect(() => {
    if (!availability[compareMode]) {
      const next = defaultCompare5dMode(availability);
      if (next) setCompareMode(next);
    }
  }, [availability, compareMode]);

  const allModulesLabel = t('analytics.allSyllabusSections', {
    sectionType: t(`syllabus.${structKey}`),
  });

  const labelForSection = useCallback(
    (id: string) => {
      if (id === 'unplaced') return t('analytics.unplacedAssignments');
      return modules.find((m) => m.id === id)?.title ?? id;
    },
    [modules, t],
  );

  const labelForStudent = useCallback(
    (id: string) => students.find((s) => s.id === id)?.fullName ?? id,
    [students],
  );

  const labelForAssignment = useCallback(
    (id: string) => assignments.find((a) => a.id === id)?.title ?? id,
    [assignments],
  );

  const labelForScopeModule = useMemo(() => {
    if (compareScopeModule === 'all') return allModulesLabel;
    if (compareScopeModule === 'unplaced') return t('analytics.unplacedAssignments');
    return modules.find((m) => m.id === compareScopeModule)?.title ?? compareScopeModule;
  }, [compareScopeModule, allModulesLabel, modules, t]);

  const labelForScopeAssignment = useMemo(() => {
    if (compareScopeAssignment === 'all') {
      return compareScopeModule === 'all'
        ? t('analytics.allAssignments')
        : t('analytics.allAssignmentsInScope');
    }
    return (
      assignments.find((a) => a.id === compareScopeAssignment)?.title ?? compareScopeAssignment
    );
  }, [compareScopeAssignment, compareScopeModule, assignments, t]);

  const sideOptions = useMemo(() => {
    const raw = sideOptionsForCompare5dMode(
      compareMode,
      students,
      assignments,
      modules,
      showUnplaced,
      compareScopeModule,
    );
    return raw.map((o) => ({
      id: o.id,
      label: o.label === '__unplaced__' ? t('analytics.unplacedAssignments') : o.label,
    }));
  }, [
    compareMode,
    students,
    assignments,
    modules,
    showUnplaced,
    compareScopeModule,
    t,
  ]);

  const labelForSide = useCallback(
    (id: string) => {
      const fromOptions = sideOptions.find((o) => o.id === id)?.label;
      if (fromOptions) return fromOptions;
      if (compareMode === 'sections') return labelForSection(id);
      if (compareMode === 'students') return labelForStudent(id);
      return labelForAssignment(id);
    },
    [sideOptions, compareMode, labelForSection, labelForStudent, labelForAssignment],
  );

  const scopedAssignments = useMemo(
    () => assignmentsInCompareScope(assignments, compareScopeModule),
    [assignments, compareScopeModule],
  );

  const onModeChange = (mode: Compare5dMode) => {
    setCompareMode(mode);
    setCompareSideA('');
    setCompareSideB('');
  };

  const onScopeModuleChange = (mod: AnalyticsModuleFilter) => {
    setCompareScopeModule(mod);
    setCompareScopeAssignment('all');
    setCompareSideA('');
    setCompareSideB('');
  };

  const onScopeAssignmentChange = (asg: 'all' | string) => {
    setCompareScopeAssignment(asg);
    setCompareSideA('');
    setCompareSideB('');
  };

  const resolveInput = useMemo(
    () => ({
      students,
      assignments,
      modules,
      rawSubmissions,
      rawSnapshots,
      sectionTitleResolver,
      labelForSection,
      labelForStudent,
      labelForAssignment,
      scopeModule: compareScopeModule,
      scopeAssignment: compareScopeAssignment,
    }),
    [
      students,
      assignments,
      modules,
      rawSubmissions,
      rawSnapshots,
      sectionTitleResolver,
      labelForSection,
      labelForStudent,
      labelForAssignment,
      compareScopeModule,
      compareScopeAssignment,
    ],
  );

  const sideA = useMemo(
    () =>
      resolveCompare5dSide({
        ...resolveInput,
        mode: compareMode,
        sideId: compareSideA,
      }),
    [resolveInput, compareMode, compareSideA],
  );

  const sideB = useMemo(
    () =>
      resolveCompare5dSide({
        ...resolveInput,
        mode: compareMode,
        sideId: compareSideB,
      }),
    [resolveInput, compareMode, compareSideB],
  );

  const scopeSummary = useMemo(
    () =>
      buildCompare5dScopeSummary(
        compareMode,
        compareScopeModule,
        compareScopeAssignment,
        assignments,
        allModulesLabel,
        t('analytics.unplacedAssignments'),
        t('analytics.allAssignments'),
        t('analytics.allAssignmentsInScope'),
        modules,
      ),
    [
      compareMode,
      compareScopeModule,
      compareScopeAssignment,
      assignments,
      allModulesLabel,
      modules,
      t,
    ],
  );

  const filterSummary = useMemo(() => {
    if (!compareSideA || !compareSideB) {
      return scopeSummary || t('analytics.compare5dTitle');
    }
    const base = t('analytics.compareNarrativeScope', {
      a: sideA.label,
      b: sideB.label,
      filters: scopeSummary || t('analytics.allAssignments'),
    });
    return base;
  }, [compareSideA, compareSideB, sideA.label, sideB.label, scopeSummary, t]);

  const modeHint = useMemo(() => {
    if (compareMode === 'sections') return t('analytics.compareHint');
    if (compareMode === 'students') return t('analytics.compareStudentsHint');
    return t('analytics.compareAssignmentsHint');
  }, [compareMode, t]);

  const narrativeIdPrefix = `5d-compare-${compareMode}-${compareSideA}-${compareSideB}-${compareScopeModule}-${compareScopeAssignment}`;

  const showCard = availability.sections || availability.students || availability.assignments;
  if (!showCard) return null;

  const canShowResults =
    compareSideA &&
    compareSideB &&
    compareSideA !== compareSideB &&
    sideA.scores &&
    sideB.scores;

  return (
    <Card
      className="rounded-[32px] border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <CardHeader className="border-b border-border pb-4">
        <CardTitle
          className={`flex items-center gap-3 text-lg font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}
        >
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <GitCompare className="h-5 w-5 text-primary" />
          </div>
          {t('analytics.compare5dTitle')}
        </CardTitle>
        <CardDescription className={isRTL ? 'text-right' : 'text-left'}>
          {t('analytics.compare5dHint')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <div className="space-y-2">
          <span
            className={`text-sm font-semibold text-muted-foreground block ${isRTL ? 'text-right' : 'text-left'}`}
          >
            {t('analytics.compareBy')}
          </span>
          <Tabs
            value={compareMode}
            onValueChange={(v) => onModeChange(v as Compare5dMode)}
          >
            <TabsList className="flex flex-wrap h-auto gap-1">
              {availability.sections ? (
                <TabsTrigger value="sections">{t('analytics.compareModeSections')}</TabsTrigger>
              ) : null}
              {availability.students ? (
                <TabsTrigger value="students">{t('analytics.compareModeStudents')}</TabsTrigger>
              ) : null}
              {availability.assignments ? (
                <TabsTrigger value="assignments">
                  {t('analytics.compareModeAssignments')}
                </TabsTrigger>
              ) : null}
            </TabsList>
          </Tabs>
          <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
            {modeHint}
          </p>
        </div>

        {compareMode !== 'sections' ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
            <div className="space-y-2 sm:min-w-[200px]">
              <span
                className={`text-sm font-semibold text-muted-foreground block ${isRTL ? 'text-right' : 'text-left'}`}
              >
                {t('analytics.compareScopeSection', {
                  sectionType: t(`syllabus.${structKey}`),
                })}
              </span>
              <Select
                value={compareScopeModule}
                onValueChange={(v) => onScopeModuleChange(v as AnalyticsModuleFilter)}
              >
                <SelectTrigger className="h-11 rounded-lg" dir={isRTL ? 'rtl' : 'ltr'}>
                  <SelectValue>{labelForScopeModule}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{allModulesLabel}</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                  {showUnplaced ? (
                    <SelectItem value="unplaced">{t('analytics.unplacedAssignments')}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            {compareMode === 'students' ? (
              <div className="space-y-2 sm:min-w-[200px]">
                <span
                  className={`text-sm font-semibold text-muted-foreground block ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {t('analytics.compareScopeAssignment')}
                </span>
                <Select
                  value={compareScopeAssignment}
                  onValueChange={(v) => onScopeAssignmentChange(v)}
                >
                  <SelectTrigger className="h-11 rounded-lg" dir={isRTL ? 'rtl' : 'ltr'}>
                    <SelectValue>{labelForScopeAssignment}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {compareScopeModule === 'all'
                        ? t('analytics.allAssignments')
                        : t('analytics.allAssignmentsInScope')}
                    </SelectItem>
                    {scopedAssignments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
          <div className="space-y-2 sm:min-w-[200px]">
            <span
              className={`text-sm font-semibold text-muted-foreground block ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('analytics.compareSideA')}
            </span>
            <Select
              value={compareSideA || '_none_'}
              onValueChange={(v) => setCompareSideA(v === '_none_' ? '' : v)}
            >
              <SelectTrigger className="h-11 rounded-lg" dir={isRTL ? 'rtl' : 'ltr'}>
                <SelectValue placeholder={t('analytics.compareSelectItem')}>
                  {compareSideA ? labelForSide(compareSideA) : t('analytics.compareSelectItem')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">{t('analytics.compareSelectItem')}</SelectItem>
                {sideOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:min-w-[200px]">
            <span
              className={`text-sm font-semibold text-muted-foreground block ${isRTL ? 'text-right' : 'text-left'}`}
            >
              {t('analytics.compareSideB')}
            </span>
            <Select
              value={compareSideB || '_none_'}
              onValueChange={(v) => setCompareSideB(v === '_none_' ? '' : v)}
            >
              <SelectTrigger className="h-11 rounded-lg" dir={isRTL ? 'rtl' : 'ltr'}>
                <SelectValue placeholder={t('analytics.compareSelectItem')}>
                  {compareSideB ? labelForSide(compareSideB) : t('analytics.compareSelectItem')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_">{t('analytics.compareSelectItem')}</SelectItem>
                {sideOptions.map((o) => (
                  <SelectItem key={`b-${o.id}`} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {compareSideA && compareSideB && compareSideA === compareSideB ? (
          <p className="text-sm text-amber-700 dark:text-amber-500">
            {t('analytics.compareSameItem')}
          </p>
        ) : null}

        {compareSideA &&
        compareSideB &&
        compareSideA !== compareSideB &&
        (!sideA.scores || !sideB.scores) ? (
          <p className="text-sm text-muted-foreground">
            {t('classroomAnalytics.noStudentDataInScope')}
          </p>
        ) : null}

        {canShowResults ? (
          <Compare5dResults
            classroomId={classroomId}
            labelA={sideA.label}
            labelB={sideB.label}
            scoresA={sideA.scores!}
            scoresB={sideB.scores!}
            qedA={sideA.qed}
            qedB={sideB.qed}
            evidenceA={sideA.evidence}
            evidenceB={sideB.evidence}
            narrativeContext={sideA.narrativeContext}
            filterSummary={filterSummary}
            narrativeIdPrefix={narrativeIdPrefix}
            language={analyticsLanguage}
            isRTL={isRTL}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
