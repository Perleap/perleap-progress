import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PERLEAP_CHAT_COMPLETION_RULES } from '@/config/perleapChatCompletionRules';
import {
  formatInlineListsForChatMarkdown,
  splitChatDisplayText,
  stripConversationCompleteMarker,
} from '@/lib/chatDisplay';
import { useAuth } from '@/contexts/useAuth';
import { prefetchClassroomAssignments } from '@/hooks/queries/useAssignmentQueries';
import {
  useClassrooms,
  useClassroomAssignments,
  useEnrolledStudents,
  prefetchEnrolledStudentsList,
  prefetchSyllabusOutlineByClassroom,
  useSyllabusOutlineForClassroom,
} from '@/hooks/queries';
import type { Assignment } from '@/types';

/** React Query stale time for syllabus/assignments when filtering admin comparison (repeat visits stay instant). */
const ADMIN_COURSE_DATA_STALE_MS = 5 * 60 * 1000;

const ALL_MODULES_VALUE = '__all__';

/** Values that mean “every syllabus section” (including legacy/alternate spellings). */
function isAllModulesChoice(id: string | null | undefined): boolean {
  if (id == null || id === '') return true;
  if (id === ALL_MODULES_VALUE) return true;
  const norm = id.trim().toLowerCase();
  return norm === 'all_modules' || norm === '_all_' || norm === '__all__';
}

type AiPromptRow = {
  id: string;
  prompt_key: string;
  prompt_name: string;
  prompt_template: string;
  description: string | null;
  variables: unknown;
  language: string | null;
  version: number | null;
};

type AssistantTurn = {
  turnIndex: number;
  /** Exact `content` from DB (post edge-process). */
  persistedContent: string;
  /** True when `raw_model_text` was saved for this assistant turn. */
  hasStoredRawModelText: boolean;
  /** OpenAI output when captured; otherwise same as `persistedContent` for legacy rows. */
  modelRaw: string;
  /** Same plain-text pipeline as student chat before Markdown/math render. */
  displayPlain: string;
};

const HARDCODED_ACCORDION_VALUE = 'admin-ai-prompts-hardcoded';

async function fetchAssistantTurnsForComparison(
  assignmentId: string,
  studentUserId: string,
): Promise<AssistantTurn[]> {
  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentUserId)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr) throw subErr;
  if (!submission?.id) return [];

  const { data: conv, error: convErr } = await supabase
    .from('assignment_conversations')
    .select('messages')
    .eq('submission_id', submission.id)
    .maybeSingle();

  if (convErr) throw convErr;
  const raw = conv?.messages;
  if (!Array.isArray(raw)) return [];

  const turns: AssistantTurn[] = [];
  let aiCount = 0;
  for (const msg of raw) {
    if (!msg || typeof msg !== 'object') continue;
    const m = msg as { role?: string; content?: unknown; raw_model_text?: unknown };
    if (m.role !== 'assistant') continue;
    const persistedContent = String(m.content ?? '');
    const rawField = typeof m.raw_model_text === 'string' ? m.raw_model_text.trim() : '';
    const hasStoredRawModelText = rawField.length > 0;
    const modelRaw = hasStoredRawModelText ? rawField : persistedContent;
    const displayPlain = splitChatDisplayText(
      formatInlineListsForChatMarkdown(stripConversationCompleteMarker(persistedContent)),
    ).join('\n\n');
    aiCount += 1;
    turns.push({
      turnIndex: aiCount,
      persistedContent,
      hasStoredRawModelText,
      modelRaw,
      displayPlain,
    });
  }
  return turns;
}

export default function AdminAiPromptsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [courseId, setCourseId] = useState<string>('');
  const [moduleId, setModuleId] = useState<string>(ALL_MODULES_VALUE);
  const [assignmentId, setAssignmentId] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');

  const prefetchCourseData = useCallback(
    (classroomId: string) => {
      if (!user?.id || !classroomId) return;
      void prefetchSyllabusOutlineByClassroom(queryClient, classroomId, ADMIN_COURSE_DATA_STALE_MS);
      void prefetchClassroomAssignments(queryClient, classroomId, ADMIN_COURSE_DATA_STALE_MS);
      void prefetchEnrolledStudentsList(queryClient, classroomId, ADMIN_COURSE_DATA_STALE_MS);
    },
    [queryClient, user?.id],
  );

  const { data: classrooms = [], isLoading: classroomsLoading } = useClassrooms('teacher');

  /** Warm lightweight syllabus outlines for every listed course so module lists are cache-hit on pick. */
  const prefetchAllCourseOutlines = useCallback(() => {
    if (!user?.id || classrooms.length === 0) return;
    for (const c of classrooms) {
      void prefetchSyllabusOutlineByClassroom(queryClient, c.id, ADMIN_COURSE_DATA_STALE_MS);
    }
  }, [user?.id, classrooms, queryClient]);

  const classroomIdsKey = useMemo(
    () => classrooms.map((c) => c.id).sort().join('\0'),
    [classrooms],
  );

  useEffect(() => {
    if (!user?.id || !classroomIdsKey) return;
    prefetchAllCourseOutlines();
  }, [user?.id, classroomIdsKey, prefetchAllCourseOutlines]);

  const { data: syllabus } = useSyllabusOutlineForClassroom(courseId || undefined, {
    staleTime: ADMIN_COURSE_DATA_STALE_MS,
  });
  const {
    data: assignmentsData,
    isPending: assignmentsPending,
  } = useClassroomAssignments(courseId || undefined, {
    staleTime: ADMIN_COURSE_DATA_STALE_MS,
  });
  const assignments = assignmentsData ?? [];
  const {
    data: enrolledData,
    isPending: studentsPending,
  } = useEnrolledStudents(courseId || undefined, {
    staleTime: ADMIN_COURSE_DATA_STALE_MS,
  });
  const enrolled = enrolledData ?? [];

  useEffect(() => {
    setModuleId(ALL_MODULES_VALUE);
    setAssignmentId('');
    setStudentId('');
  }, [courseId]);

  useEffect(() => {
    setAssignmentId('');
  }, [moduleId]);

  useEffect(() => {
    if (isAllModulesChoice(moduleId) && moduleId !== ALL_MODULES_VALUE) {
      setModuleId(ALL_MODULES_VALUE);
    }
  }, [moduleId]);

  const sections = syllabus?.sections ?? [];

  const filteredAssignments = useMemo(() => {
    if (isAllModulesChoice(moduleId)) return assignments;
    return assignments.filter((a: Assignment) => a.syllabus_section_id === moduleId);
  }, [assignments, moduleId]);

  /** Drop stale assignment when the filtered list no longer includes the current id (keeps Select + labels in sync). */
  useEffect(() => {
    if (assignmentsPending || !assignmentId) return;
    if (assignments.length === 0) return;
    if (!filteredAssignments.some((a: Assignment) => a.id === assignmentId)) {
      setAssignmentId('');
    }
  }, [assignmentsPending, assignmentId, assignments.length, filteredAssignments]);

  const handleCourseChange = (v: string) => {
    void prefetchSyllabusOutlineByClassroom(queryClient, v, ADMIN_COURSE_DATA_STALE_MS);
    if (user?.id) {
      void prefetchClassroomAssignments(queryClient, v, ADMIN_COURSE_DATA_STALE_MS);
      void prefetchEnrolledStudentsList(queryClient, v, ADMIN_COURSE_DATA_STALE_MS);
    }
    setCourseId(v);
  };

  const promptsQuery = useQuery({
    queryKey: ['admin_ai_prompts_student_chat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_prompts')
        .select('id, prompt_key, prompt_name, prompt_template, description, variables, language, version')
        .like('prompt_key', 'chat%')
        .eq('is_active', true)
        .order('prompt_key', { ascending: true })
        .order('language', { ascending: true });

      if (error) throw error;
      return (data ?? []) as AiPromptRow[];
    },
  });

  const comparisonQuery = useQuery({
    queryKey: ['admin_ai_prompts_comparison', assignmentId, studentId],
    queryFn: () => fetchAssistantTurnsForComparison(assignmentId, studentId),
    enabled: Boolean(assignmentId && studentId),
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.aiPrompts.title')}</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">{t('admin.aiPrompts.subtitle')}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t('admin.aiPrompts.sectionDb')}</h2>
        {promptsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : promptsQuery.isError ? (
          <p className="text-sm text-destructive">{(promptsQuery.error as Error).message}</p>
        ) : (
          <Accordion multiple className="w-full rounded-lg border px-2">
            {(promptsQuery.data ?? []).map((row) => (
              <AccordionItem value={row.id} key={row.id}>
                <AccordionTrigger className="text-left text-sm hover:no-underline">
                  <span className="font-medium">
                    {row.prompt_name}{' '}
                    <span className="text-muted-foreground font-normal">
                      ({row.prompt_key}
                      {row.language ? ` · ${row.language}` : ''})
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  {row.description ? (
                    <p className="text-sm text-muted-foreground">{row.description}</p>
                  ) : null}
                  {row.variables != null ? (
                    <p className="text-xs font-mono text-muted-foreground">
                      {t('admin.aiPrompts.variables')}: {JSON.stringify(row.variables)}
                    </p>
                  ) : null}
                  <pre className="max-h-[320px] overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap">
                    {row.prompt_template}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            ))}

            <AccordionItem value={HARDCODED_ACCORDION_VALUE}>
              <AccordionTrigger className="text-left text-sm hover:no-underline">
                <span className="font-medium">{t('admin.aiPrompts.sectionHardcoded')}</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                <p className="text-sm text-muted-foreground">{t('admin.aiPrompts.hardcodedHint')}</p>
                <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap">
                  {PERLEAP_CHAT_COMPLETION_RULES.trim()}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">{t('admin.aiPrompts.comparison.title')}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('admin.aiPrompts.comparison.subtitle')}
          </p>
        </div>

        <div className="isolate relative z-0 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <div className="min-w-0 space-y-2">
            <Label>{t('admin.aiPrompts.comparison.course')}</Label>
            <Select
              value={courseId || null}
              onValueChange={handleCourseChange}
              onOpenChange={(open) => {
                if (open) prefetchAllCourseOutlines();
              }}
              disabled={classroomsLoading}
              modal={false}
            >
              <SelectTrigger className="w-full min-w-0 max-w-full overflow-hidden">
                <SelectValue placeholder={t('admin.aiPrompts.comparison.selectCourse')}>
                  {(v) =>
                    v ? (
                      <span className="truncate">
                        {classrooms.find((c) => c.id === v)?.name?.trim() ||
                          t('admin.aiPrompts.comparison.unknownItem')}
                      </span>
                    ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {classrooms.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={c.id}
                    onPointerEnter={() => prefetchCourseData(c.id)}
                    onPointerDown={() => prefetchCourseData(c.id)}
                  >
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-2">
            <Label>{t('admin.aiPrompts.comparison.module')}</Label>
            <Select
              value={courseId ? moduleId : null}
              onValueChange={setModuleId}
              disabled={!courseId}
              modal={false}
            >
              <SelectTrigger className="w-full min-w-0 max-w-full overflow-hidden">
                <SelectValue placeholder={t('admin.aiPrompts.comparison.selectModule')}>
                  {(v) =>
                    v && courseId ? (
                      <span className="truncate">
                        {isAllModulesChoice(v)
                          ? t('admin.aiPrompts.comparison.allModules')
                          : sections.find((s) => s.id === v)?.title?.trim() ||
                            t('admin.aiPrompts.comparison.unknownItem')}
                      </span>
                    ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_MODULES_VALUE}>
                  {t('admin.aiPrompts.comparison.allModules')}
                </SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title || s.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-2">
            <Label>{t('admin.aiPrompts.comparison.assignment')}</Label>
            <Select
              value={assignmentId || null}
              onValueChange={setAssignmentId}
              disabled={!courseId || (assignmentsPending && assignmentsData === undefined)}
              modal={false}
            >
              <SelectTrigger className="w-full min-w-0 max-w-full overflow-hidden">
                <SelectValue placeholder={t('admin.aiPrompts.comparison.selectAssignment')}>
                  {(v) =>
                    v ? (
                      <span className="truncate">
                        {(
                          filteredAssignments.find((a: Assignment) => a.id === v) ??
                          assignments.find((a: Assignment) => a.id === v)
                        )?.title?.trim() || t('admin.aiPrompts.comparison.unknownItem')}
                      </span>
                    ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {filteredAssignments.map((a: Assignment) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title?.trim() || t('admin.aiPrompts.comparison.unknownItem')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-2">
            <Label>{t('admin.aiPrompts.comparison.student')}</Label>
            <Select
              value={studentId || null}
              onValueChange={setStudentId}
              disabled={!courseId || (studentsPending && enrolledData === undefined)}
              modal={false}
            >
              <SelectTrigger className="w-full min-w-0 max-w-full overflow-hidden">
                <SelectValue placeholder={t('admin.aiPrompts.comparison.selectStudent')}>
                  {(v) =>
                    v ? (
                      <span className="truncate">
                        {enrolled.find((e) => e.student_id === v)?.student_profiles?.full_name?.trim() ||
                          t('admin.aiPrompts.comparison.unnamedStudent')}
                      </span>
                    ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {enrolled.map((e) => {
                  const name =
                    e.student_profiles?.full_name?.trim() ||
                    t('admin.aiPrompts.comparison.unnamedStudent');
                  return (
                    <SelectItem key={e.student_id} value={e.student_id}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!assignmentId || !studentId ? (
          <p className="text-sm text-muted-foreground">{t('admin.aiPrompts.comparison.pickFilters')}</p>
        ) : comparisonQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : comparisonQuery.isError ? (
          <p className="text-sm text-destructive">{(comparisonQuery.error as Error).message}</p>
        ) : comparisonQuery.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.aiPrompts.comparison.noConversation')}</p>
        ) : (
          <div className="space-y-6">
            {comparisonQuery.data!.map((turn) => (
              <div
                key={turn.turnIndex}
                className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2"
              >
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {t('admin.aiPrompts.comparison.modelRawLabel', { n: turn.turnIndex })}
                  </h3>
                  <pre className="max-h-[280px] overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap">
                    {turn.modelRaw || '—'}
                  </pre>
                  {!turn.hasStoredRawModelText ? (
                    <p className="text-xs text-muted-foreground">
                      {t('admin.aiPrompts.comparison.rawNotStoredHint')}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    {t('admin.aiPrompts.comparison.displayBaselineLabel', { n: turn.turnIndex })}
                  </h3>
                  <pre className="max-h-[280px] overflow-auto rounded-md bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap">
                    {turn.displayPlain || '—'}
                  </pre>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{t('admin.aiPrompts.comparison.comparisonFooter')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
