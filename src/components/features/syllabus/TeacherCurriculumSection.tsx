import { useState, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Search, Pencil, Trash2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSyllabus, useClassroomAssignments, useReplaceModuleFlow } from '@/hooks/queries';
import { syllabusKeys } from '@/hooks/queries/useSyllabusQueries';
import { useModuleFlowStepsBulk, moduleFlowKeys } from '@/hooks/queries/useModuleFlowQueries';
import {
  moduleFlowLocalStepsToFlowInput,
  resolveDisplayedModuleFlowBase,
} from '@/lib/moduleFlow';
import type { SectionResource } from '@/types/syllabus';
import { cn } from '@/lib/utils';
import { ModuleLessonActivityDialog } from './ModuleLessonActivityDialog';
import { ModuleActivityCard } from './activities/ModuleActivityCard';

interface TeacherCurriculumSectionProps {
  classroomId: string;
  isRTL: boolean;
  onEditAssignment: (assignmentId: string) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onCreateAssignmentForModule: (sectionId: string) => void;
}

export function TeacherCurriculumSection({
  classroomId,
  isRTL,
  onEditAssignment,
  onDeleteAssignment,
  onCreateAssignmentForModule,
}: TeacherCurriculumSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const replaceFlow = useReplaceModuleFlow();
  const { data: syllabus, isLoading } = useSyllabus(classroomId);
  const { data: assignmentsQuery = [] } = useClassroomAssignments(classroomId);

  const assignmentRows = assignmentsQuery as {
    id: string;
    title: string;
    syllabus_section_id?: string | null;
    due_at?: string | null;
    status: 'draft' | 'published';
    type?: string;
  }[];

  const sections = useMemo(() => {
    const list = syllabus?.sections ?? [];
    return [...list].sort((a, b) => a.order_index - b.order_index);
  }, [syllabus?.sections]);

  const sectionIdSet = useMemo(() => new Set(sections.map((s) => s.id)), [sections]);

  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const { data: flowBulk = {} } = useModuleFlowStepsBulk(sectionIds);

  const resourceMap = syllabus?.section_resources ?? {};

  const assignmentById = useMemo(() => {
    const m: Record<
      string,
      {
        id: string;
        title: string;
        status: 'draft' | 'published';
        due_at: string | null;
        type?: string;
      }
    > = {};
    for (const a of assignmentRows) {
      m[a.id] = {
        id: a.id,
        title: a.title,
        status: a.status === 'published' ? 'published' : 'draft',
        due_at: a.due_at ?? null,
        type: a.type,
      };
    }
    return m;
  }, [assignmentRows]);

  const unassignedAssignments = useMemo(() => {
    return assignmentRows.filter((a) => {
      const sid = a.syllabus_section_id;
      return sid == null || sid === '' || !sectionIdSet.has(sid);
    });
  }, [assignmentRows, sectionIdSet]);

  const [lessonSectionId, setLessonSectionId] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<SectionResource | null>(null);
  const [moduleSearch, setModuleSearch] = useState('');
  const [moduleOpenById, setModuleOpenById] = useState<Record<string, boolean>>({});

  const lessonCreatedFromExpandedPlusRef = useRef(false);

  const openNewLesson = (sectionId: string) => {
    setLessonSectionId(sectionId);
    setEditingLesson(null);
  };

  const openEditLesson = (sectionId: string, r: SectionResource) => {
    setLessonSectionId(sectionId);
    setEditingLesson(r);
  };

  const filteredSections = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => {
      if (s.title.toLowerCase().includes(q)) return true;
      const resources = resourceMap[s.id] ?? [];
      const persisted = flowBulk[s.id] ?? [];
      const flowSteps = resolveDisplayedModuleFlowBase(s.id, resources, assignmentRows, persisted);
      for (const step of flowSteps) {
        if (step.kind === 'resource') {
          const r = resources.find((x) => x.id === step.resourceId);
          if (r?.title.toLowerCase().includes(q)) return true;
        } else {
          const a = assignmentById[step.assignmentId];
          if (a?.title.toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [sections, moduleSearch, resourceMap, flowBulk, assignmentRows, assignmentById]);

  const filteredUnassignedAssignments = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase();
    if (!q) return unassignedAssignments;
    return unassignedAssignments.filter((a) => a.title.toLowerCase().includes(q));
  }, [unassignedAssignments, moduleSearch]);

  const allFilteredOpen = useMemo(
    () =>
      filteredSections.length > 0 &&
      filteredSections.every((s) => moduleOpenById[s.id] === true),
    [filteredSections, moduleOpenById],
  );

  useEffect(() => {
    const q = moduleSearch.trim();
    if (!q) return;
    setModuleOpenById((prev) => {
      const next = { ...prev };
      for (const s of filteredSections) {
        next[s.id] = true;
      }
      return next;
    });
  }, [moduleSearch, filteredSections]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!syllabus || sections.length === 0) {
    return (
      <Card className="rounded-xl border-dashed border-2 border-border bg-muted/20">
        <CardHeader>
          <CardTitle className={cn(isRTL && 'text-right')}>
            {t('classroomDetail.curriculum.title')}
          </CardTitle>
          <CardDescription className={cn(isRTL && 'text-right')}>
            {t('classroomDetail.curriculum.emptyNoModulesHint')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className={cn('space-y-4', isRTL && 'text-right')}>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {t('classroomDetail.curriculum.title')}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-base">
            {t('classroomDetail.curriculum.subtitle')}
          </p>
        </div>

        <div
          className={cn(
            'flex w-full items-stretch gap-3 sm:items-center sm:justify-between',
            isRTL && 'flex-row-reverse',
          )}
        >
          <div className="relative min-w-0 w-full max-w-2xl flex-1">
            <Search
              className={cn(
                'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
                isRTL ? 'end-3' : 'start-3',
              )}
              aria-hidden
            />
            <Input
              value={moduleSearch}
              onChange={(e) => setModuleSearch(e.target.value)}
              placeholder={t('classroomDetail.activities.searchModulesPlaceholder')}
              className={cn('h-10 w-full', isRTL ? 'pe-9 ps-3' : 'ps-9 pe-3')}
              aria-label={t('classroomDetail.activities.searchModulesPlaceholder')}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="default"
            className="shrink-0 whitespace-nowrap"
            disabled={filteredSections.length === 0}
            onClick={() => {
              if (allFilteredOpen) {
                setModuleOpenById((prev) => {
                  const next = { ...prev };
                  for (const s of filteredSections) next[s.id] = false;
                  return next;
                });
              } else {
                setModuleOpenById((prev) => {
                  const next = { ...prev };
                  for (const s of filteredSections) next[s.id] = true;
                  return next;
                });
              }
            }}
          >
            {allFilteredOpen
              ? t('classroomDetail.curriculum.collapseAll')
              : t('classroomDetail.curriculum.expandAll')}
          </Button>
        </div>
      </div>

      {filteredUnassignedAssignments.length > 0 ? (
        <Card className="rounded-xl border border-border/80 bg-muted/20 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('classroomDetail.curriculum.unassignedTitle')}</CardTitle>
            <CardDescription>{t('classroomDetail.curriculum.unassignedDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {filteredUnassignedAssignments.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'flex min-w-0 items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5',
                  isRTL && 'flex-row-reverse',
                )}
              >
                <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className={cn('min-w-0 flex-1', isRTL && 'text-right')}>
                  <div className="truncate text-sm font-medium text-foreground">{a.title}</div>
                  <div
                    className={cn(
                      'mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground',
                      isRTL && 'justify-end',
                    )}
                  >
                    {a.type ? (
                      <span>
                        {t('classroomDetail.type')} {t(`assignmentTypes.${a.type}`, a.type)}
                      </span>
                    ) : null}
                    {a.due_at ? (
                      <span>
                        {t('classroomDetail.due')} {new Date(a.due_at).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className={cn('flex shrink-0 gap-0.5', isRTL && 'flex-row-reverse')}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label={t('classroomDetail.activitiesFlow.editStep')}
                    onClick={() => onEditAssignment(a.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label={t('common.delete')}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `${t('planner.deleteConfirmTitle')}\n\n${t('planner.deleteConfirmDescription')}`,
                        )
                      ) {
                        return;
                      }
                      onDeleteAssignment(a.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {filteredSections.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('classroomDetail.activities.noModulesMatchSearch')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredSections.map((section) => {
            const resources = resourceMap[section.id] ?? [];
            const persisted = flowBulk[section.id] ?? [];
            /** Saved `module_flow_steps` order (or computed default when empty). */
            const flowSteps = resolveDisplayedModuleFlowBase(
              section.id,
              resources,
              assignmentRows,
              persisted,
            );
            const resourceById: Record<string, SectionResource> = {};
            for (const r of resources) {
              resourceById[r.id] = r;
            }
            return (
              <ModuleActivityCard
                key={section.id}
                classroomId={classroomId}
                section={{ id: section.id, title: section.title }}
                flowSteps={flowSteps}
                assignmentById={assignmentById}
                resourceById={resourceById}
                isRTL={isRTL}
                curriculumSearchQuery={moduleSearch}
                open={moduleOpenById[section.id] ?? false}
                onOpenChange={(next) =>
                  setModuleOpenById((prev) => ({ ...prev, [section.id]: next }))
                }
                onAddActivity={() => {
                  lessonCreatedFromExpandedPlusRef.current = true;
                  openNewLesson(section.id);
                }}
                onCreateAssignmentForModule={() => onCreateAssignmentForModule(section.id)}
                onEditResource={(resourceId) => {
                  const r = resourceById[resourceId];
                  if (r) openEditLesson(section.id, r);
                }}
                onEditAssignment={onEditAssignment}
                onDeleteAssignment={onDeleteAssignment}
              />
            );
          })}
        </div>
      )}

      <ModuleLessonActivityDialog
        classroomId={classroomId}
        isRTL={isRTL}
        open={lessonSectionId !== null}
        onOpenChange={(o) => {
          if (!o) {
            setLessonSectionId(null);
            setEditingLesson(null);
            lessonCreatedFromExpandedPlusRef.current = false;
          }
        }}
        sectionId={lessonSectionId}
        editingLesson={editingLesson}
        sectionResourcesBySection={resourceMap}
        onLessonCreated={async (resourceId) => {
          if (lessonCreatedFromExpandedPlusRef.current && lessonSectionId) {
            const sid = lessonSectionId;
            const resources = resourceMap[sid] ?? [];
            const persisted = flowBulk[sid] ?? [];
            const next = resolveDisplayedModuleFlowBase(sid, resources, assignmentRows, persisted);
            const already = next.some(
              (s) => s.kind === 'resource' && s.resourceId === resourceId,
            );
            if (!already) {
              try {
                await replaceFlow.mutateAsync({
                  sectionId: sid,
                  classroomId,
                  steps: moduleFlowLocalStepsToFlowInput([
                    ...next,
                    { kind: 'resource', resourceId },
                  ]),
                });
                await queryClient.refetchQueries({ queryKey: moduleFlowKeys.all });
                await queryClient.refetchQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
              } catch {
                toast.error(t('classroomDetail.activitiesFlow.saveFailed'));
              }
            }
            lessonCreatedFromExpandedPlusRef.current = false;
          }
        }}
      />
    </div>
  );
}
