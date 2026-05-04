import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Loader2, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SubmissionPrivateNotesTab } from './SubmissionPrivateNotesTab';
import { LangchainPipelineView } from './LangchainPipelineView';
import { PresentationSubmissionView } from './PresentationSubmissionView';
import { ProjectSubmissionView } from './ProjectSubmissionView';
import { TestResultsView } from './TestResultsView';
import type { Message } from '@/types';
import type { StudentAlert } from '@/types/alerts';
import { HardSkillsAssessmentTable } from '@/components/HardSkillsAssessmentTable';
import SafeMathMarkdown from '@/components/SafeMathMarkdown';
import { LessonReadingDetailsCollapsible } from '@/components/features/syllabus/content-blocks/LessonReadingDetailsCollapsible';
import { StudentAnalytics } from '@/components/StudentAnalytics';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { WellbeingAlertCard } from '@/components/WellbeingAlertCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import {
  submissionKeys,
  useTeacherConversationMessages,
  useTeacherChatSentenceFlags,
} from '@/hooks/queries';
import {
  formatInlineListsForChatMarkdown,
  splitAssistantMessageIntoSentences,
} from '@/lib/chatDisplay';
import { cn } from '@/lib/utils';
import {
  generateFeedback,
  releaseAiFeedbackToStudent,
  updateAssignmentFeedbackText,
} from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';

type SubmissionTabValue = 'evaluation' | 'feedback' | 'assignment' | 'notes';

interface SubmissionTabsProps {
  submission: {
    id: string;
    student_id: string;
    submitted_at: string;
    status?: string;
    is_teacher_attempt?: boolean | null;
    /** True if chat had reached in-app "conversation complete" at submit; false if early. */
    conversation_complete_at_submit?: boolean | null;
    /** When true, student is still waiting for teacher to publish feedback. */
    awaiting_teacher_feedback_release?: boolean;
    file_url?: string | null;
    text_body?: string | null;
    assignments: {
      id: string;
      classroom_id: string;
      title: string;
      instructions?: string;
      type: string;
      auto_publish_ai_feedback?: boolean;
      /** AI-generated short task shown to students before they start. */
      student_facing_task?: string | null;
      classrooms?: { name?: string; teacher_id?: string } | null;
    };
  };
  feedback: {
    teacher_feedback: string | null;
    student_feedback: string | null;
    conversation_context: Message[] | null;
    visible_to_student?: boolean;
  } | null;
  studentName: string;
  alerts: StudentAlert[];
  onAcknowledgeAlert: () => void;
  onEvaluationComplete?: () => void;
}

export const SubmissionTabs = ({
  submission,
  feedback,
  studentName,
  alerts,
  onAcknowledgeAlert,
  onEvaluationComplete,
}: SubmissionTabsProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { language: uiLanguage = 'en', isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const [releasing, setReleasing] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [teacherDraft, setTeacherDraft] = useState('');
  const [studentDraft, setStudentDraft] = useState('');
  const assignmentType = submission.assignments.type;

  const nonChatAssignmentTypes = [
    'test',
    'project',
    'presentation',
    'langchain',
    'text_essay',
  ] as const;
  const isChatLikeAssignment = !nonChatAssignmentTypes.includes(
    assignmentType as (typeof nonChatAssignmentTypes)[number]
  );

  /** Feedback first when present (edit/publish); otherwise student work tab (scores, transcript, AI actions). */
  const [activeTab, setActiveTab] = useState<SubmissionTabValue>(() =>
    feedback != null ? 'feedback' : 'assignment'
  );

  const assignmentTabLoadsChatData = activeTab === 'assignment';

  const { data: liveConversationMessages, isLoading: liveConversationLoading } =
    useTeacherConversationMessages(
      submission.id,
      isChatLikeAssignment && assignmentTabLoadsChatData
    );

  const { data: chatSentenceFlagsRaw } = useTeacherChatSentenceFlags(
    submission.id,
    isChatLikeAssignment && assignmentTabLoadsChatData
  );
  const chatSentenceFlags = chatSentenceFlagsRaw ?? [];
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const [highlightSentence, setHighlightSentence] = useState<{
    messageIndex: number;
    sentenceIndex: number;
  } | null>(null);

  useEffect(() => {
    if (!highlightSentence) return;
    const clear = window.setTimeout(() => setHighlightSentence(null), 2800);
    return () => clearTimeout(clear);
  }, [highlightSentence]);

  const scrollToFlaggedChatSentence = useCallback((messageIndex: number, sentenceIndex: number) => {
    setHighlightSentence({ messageIndex, sentenceIndex });
    const elementId = `teacher-chat-sentence-${messageIndex}-${sentenceIndex}`;
    requestAnimationFrame(() => {
      const root = transcriptScrollRef.current;
      const el =
        root?.querySelector(`#${elementId}`) ??
        (typeof document !== 'undefined' ? document.getElementById(elementId) : null);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  /** Assignment requires teacher to publish (AI feedback to students = No). */
  const assignmentGated = submission.assignments?.auto_publish_ai_feedback === false;

  const awaitingStudentRelease = submission.awaiting_teacher_feedback_release === true;
  const feedbackMarkedVisible = feedback?.visible_to_student === true;

  /** Student has full access: visible row and submission no longer awaiting release. */
  const fullyReleasedToStudent = feedbackMarkedVisible && !awaitingStudentRelease;

  /**
   * Show publish next to Save when it can matter: gated assignment, or DB says not visible / still awaiting.
   */
  const showPublishSection =
    !!feedback && (assignmentGated || !feedbackMarkedVisible || awaitingStudentRelease);

  const studentSeesPublishedFeedback = fullyReleasedToStudent;

  useEffect(() => {
    if (!feedback) return;
    setTeacherDraft(feedback.teacher_feedback ?? '');
    setStudentDraft(feedback.student_feedback ?? '');
  }, [feedback?.teacher_feedback, feedback?.student_feedback, feedback?.visible_to_student]);

  const canGenerateAiFeedback =
    submission.status === 'completed' &&
    !feedback &&
    !submission.is_teacher_attempt &&
    ['text_essay', 'test', 'questions', 'chatbot'].includes(assignmentType);

  const handleGenerateAiEvaluation = async () => {
    setGeneratingAi(true);
    try {
      const language = getAssignmentLanguage(submission.assignments.instructions || '', uiLanguage);
      const { error } = await generateFeedback({
        submissionId: submission.id,
        studentId: submission.student_id,
        assignmentId: submission.assignments.id,
        language,
      });
      if (error) throw error;
      toast.success(t('submissionDetail.generateAiEvaluation.success'));
      await queryClient.invalidateQueries({
        queryKey: submissionKeys.conversation(submission.id),
      });
      onEvaluationComplete?.();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleReleaseFeedback = async () => {
    if (!feedback) return;
    setReleasing(true);
    try {
      const { success, error } = await releaseAiFeedbackToStudent({
        submissionId: submission.id,
        studentId: submission.student_id,
        assignmentId: submission.assignments.id,
        assignmentTitle: submission.assignments.title,
        teacherId: submission.assignments.classrooms?.teacher_id ?? user?.id ?? null,
      });
      if (error || !success) throw error ?? new Error('release failed');
      toast.success(t('submissionDetail.releaseFeedback.success'));
      onEvaluationComplete?.();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setReleasing(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!feedback) return;
    setSavingEdits(true);
    try {
      const { success, error } = await updateAssignmentFeedbackText({
        submissionId: submission.id,
        teacher_feedback: teacherDraft,
        student_feedback: studentDraft,
        editNotification: {
          studentId: submission.student_id,
          assignmentId: submission.assignments.id,
          assignmentTitle: submission.assignments.title,
          teacherId: submission.assignments.classrooms?.teacher_id ?? user?.id ?? null,
          title: t('notifications.titles.feedbackUpdated'),
          message: t('notifications.messages.feedbackUpdated', {
            title: submission.assignments.title,
          }),
          previousTeacher: feedback.teacher_feedback ?? null,
          previousStudent: feedback.student_feedback ?? null,
          shouldNotify: studentSeesPublishedFeedback,
        },
      });
      if (error || !success) throw error ?? new Error('save failed');
      toast.success(t('submissionDetail.editFeedback.saved'));
      onEvaluationComplete?.();
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSavingEdits(false);
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as SubmissionTabValue)}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2 min-[520px]:grid-cols-4 gap-1 h-auto min-h-12 rounded-xl bg-muted/50 p-1">
        <TabsTrigger value="evaluation" className="rounded-lg data-[state=active]:shadow-sm text-xs sm:text-sm">
          {t('submissionDetail.tabs.evaluation')}
        </TabsTrigger>
        <TabsTrigger value="feedback" className="rounded-lg data-[state=active]:shadow-sm text-xs sm:text-sm">
          {t('submissionDetail.tabs.feedback')}
        </TabsTrigger>
        <TabsTrigger value="assignment" className="rounded-lg data-[state=active]:shadow-sm text-xs sm:text-sm">
          {t('submissionDetail.tabs.assignment')}
        </TabsTrigger>
        <TabsTrigger value="notes" className="rounded-lg data-[state=active]:shadow-sm text-xs sm:text-sm">
          {t('submissionDetail.tabs.notes')}
        </TabsTrigger>
      </TabsList>

      {/* Tab 1: Evaluation — mount only when selected to avoid CRA/analytics waterfall on default Feedback/Assignment tab */}
      <TabsContent value="evaluation" className="mt-6 space-y-8">
        {activeTab === 'evaluation' ? (
          <>
            <StudentAnalytics
              studentId={submission.student_id}
              classroomId={submission.assignments.classroom_id}
              currentSubmissionId={submission.id}
            />

            <HardSkillsAssessmentTable
              submissionId={submission.id}
              layout="flat"
              title={t('cra.title')}
              description={t('classroomAnalytics.hardSkillsFor', { student: studentName })}
            />
          </>
        ) : null}
      </TabsContent>

      {/* Tab 2: Feedback */}
      <TabsContent value="feedback" className="mt-6 space-y-6">
        {alerts.length > 0 && (
          <WellbeingAlertCard
            alerts={alerts}
            studentName={studentName}
            onAcknowledge={onAcknowledgeAlert}
          />
        )}

        {feedback ? (
          <div className="space-y-6">
            {studentSeesPublishedFeedback ? (
              <p className="text-sm text-muted-foreground">
                {t('submissionDetail.editFeedback.visibleToStudent')}
              </p>
            ) : null}

            <Card className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden p-0 gap-0">
              <CardHeader className="bg-accent dark:bg-accent/30 px-6 py-4 pb-4 text-left rounded-t-xl">
                <CardTitle className="text-foreground text-left">
                  {t('submissionDetail.teacherFeedback')}
                </CardTitle>
                <CardDescription className="text-left text-xs pt-1">
                  {t('submissionDetail.editFeedback.teacherHint')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-4 space-y-3">
                <Textarea
                  value={teacherDraft}
                  onChange={(e) => setTeacherDraft(e.target.value)}
                  className="min-h-[140px] text-sm rounded-lg"
                  placeholder={t('submissionDetail.editFeedback.teacherPlaceholder')}
                />
              </CardContent>
            </Card>

            <Card className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden p-0 gap-0">
              <CardHeader className="bg-accent dark:bg-accent/30 px-6 py-4 pb-4 text-left rounded-t-xl">
                <CardTitle className="text-foreground text-left">
                  {t('submissionDetail.studentFeedback')}
                </CardTitle>
                <CardDescription className="text-left text-xs pt-1">
                  {t('submissionDetail.editFeedback.studentHint')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-4 space-y-3">
                <Textarea
                  value={studentDraft}
                  onChange={(e) => setStudentDraft(e.target.value)}
                  className="min-h-[180px] text-sm rounded-lg"
                  placeholder={t('submissionDetail.editFeedback.studentPlaceholder')}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleSaveEdits()}
                    disabled={savingEdits}
                    className="rounded-xl"
                  >
                    {savingEdits ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                    {t('submissionDetail.editFeedback.save')}
                  </Button>
                  {showPublishSection ? (
                    <Button
                      type="button"
                      onClick={() => void handleReleaseFeedback()}
                      disabled={releasing}
                      className="rounded-xl"
                    >
                      {releasing ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : null}
                      {t('submissionDetail.releaseFeedback.action')}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium text-center px-4">
                {isChatLikeAssignment
                  ? t('submissionDetail.feedbackEmpty.chatPrompt')
                  : t('submissionDetail.teacherEvaluation.awaitingEvaluation')}
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Tab 3: Assignment (type-dependent content) */}
      <TabsContent value="assignment" className="mt-6 space-y-6">
        <Card className="border-border/80 bg-muted/20">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium text-start">
              {t('createAssignment.wizard.studentFacingTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm">
            {submission.assignments.student_facing_task?.trim() ? (
              <p
                className="whitespace-pre-wrap text-foreground leading-relaxed text-start"
                dir="auto"
              >
                {submission.assignments.student_facing_task.trim()}
              </p>
            ) : (
              <p className="text-muted-foreground leading-relaxed text-start" dir="auto">
                {t('submissionDetail.noStudentFacingTask')}
              </p>
            )}
          </CardContent>
        </Card>

        {(() => {
          const evalProps = {
            submissionId: submission.id,
            studentId: submission.student_id,
            assignmentId: submission.assignments.id,
            hasFeedback: !!feedback,
            onEvaluationComplete: onEvaluationComplete || (() => {}),
          };

          switch (assignmentType) {
            case 'test':
              return (
                <div className="space-y-6">
                  <TestResultsView
                    assignmentId={submission.assignments.id}
                    submissionId={submission.id}
                  />
                  {canGenerateAiFeedback ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() => void handleGenerateAiEvaluation()}
                        disabled={generatingAi}
                        className="rounded-xl gap-2"
                      >
                        {generatingAi ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {t('submissionDetail.generateAiEvaluation.action')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            case 'project':
              return <ProjectSubmissionView fileUrl={submission.file_url} {...evalProps} />;
            case 'presentation':
              return <PresentationSubmissionView fileUrl={submission.file_url} {...evalProps} />;
            case 'langchain':
              return <LangchainPipelineView textBody={submission.text_body} {...evalProps} />;
            case 'text_essay':
              return (
                <div className="space-y-6">
                  <Card className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-base text-left">
                        {submission.assignments.title}
                      </CardTitle>
                      {submission.assignments.instructions?.trim() ? (
                        <LessonReadingDetailsCollapsible
                          className="mt-3"
                          triggerLabel={t('submissionDetail.fullAssignmentInstructions')}
                        >
                          <SafeMathMarkdown
                            content={submission.assignments.instructions}
                            className="text-left text-sm text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                          />
                        </LessonReadingDetailsCollapsible>
                      ) : null}
                    </CardHeader>
                  </Card>
                  <Card className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-base text-left">
                        {t('submissionDetail.essaySubmission')}
                      </CardTitle>
                      <CardDescription className="text-left text-xs">
                        {t('submissionDetail.essaySubmissionDesc', { student: studentName })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="whitespace-pre-wrap rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-800 dark:text-slate-200 min-h-[200px]">
                        {submission.text_body?.trim() || t('submissionDetail.essayEmpty')}
                      </div>
                      {canGenerateAiFeedback ? (
                        <div className="mt-4 flex justify-end">
                          <Button
                            type="button"
                            onClick={() => void handleGenerateAiEvaluation()}
                            disabled={generatingAi}
                            className="rounded-xl gap-2"
                          >
                            {generatingAi ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            {t('submissionDetail.generateAiEvaluation.action')}
                          </Button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>
              );
            default: {
              const transcriptMessages: Message[] = (() => {
                if (liveConversationMessages && liveConversationMessages.length > 0) {
                  return liveConversationMessages;
                }
                const ctx = feedback?.conversation_context;
                if (ctx && Array.isArray(ctx)) return ctx as Message[];
                return [];
              })();

              return (
                <div className="space-y-6">
                  {isChatLikeAssignment && submission.conversation_complete_at_submit === false && (
                    <Alert
                      className="flex flex-row items-center gap-3 border-amber-500/40 bg-amber-500/5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100 [&>svg]:translate-y-0"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    >
                      <AlertTriangle className="shrink-0 text-amber-600 dark:text-amber-500" />
                      <div className="min-w-0 flex flex-1 flex-col gap-0.5 text-start">
                        <AlertTitle className="text-start">
                          {t('submissionDetail.conversationFlowEarlyTitle')}
                        </AlertTitle>
                        <AlertDescription className="text-start text-pretty">
                          {t('submissionDetail.conversationFlowEarlyDescription')}
                        </AlertDescription>
                      </div>
                    </Alert>
                  )}

                  <Card className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-base text-left">
                        {submission.assignments.title}
                      </CardTitle>
                      {submission.assignments.instructions?.trim() ? (
                        <LessonReadingDetailsCollapsible
                          className="mt-3"
                          triggerLabel={t('submissionDetail.fullAssignmentInstructions')}
                        >
                          <SafeMathMarkdown
                            content={submission.assignments.instructions}
                            className="text-left text-sm text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                          />
                        </LessonReadingDetailsCollapsible>
                      ) : null}
                    </CardHeader>
                  </Card>

                  {isChatLikeAssignment && chatSentenceFlags.length > 0 ? (
                    <Card className="rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden">
                      <CardHeader className="px-6 py-4">
                        <CardTitle className="text-base font-semibold text-left">
                          {t('submissionDetail.flaggedSentencesTitle')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 px-6 pb-6 pt-0">
                        {chatSentenceFlags.map((row) => (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() =>
                              scrollToFlaggedChatSentence(row.message_index, row.sentence_index)
                            }
                            className={cn(
                              'w-full rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-left',
                              'transition-colors hover:bg-slate-100/90 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/70',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-slate-900 dark:text-slate-100">
                              {row.sentence_text}
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {new Date(row.created_at).toLocaleString(
                                uiLanguage === 'he' ? 'he-IL' : undefined,
                                { dateStyle: 'short', timeStyle: 'short' }
                              )}
                            </p>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  <Card className="flex min-h-[420px] flex-col rounded-xl border-none shadow-sm bg-white dark:bg-slate-900/50 ring-1 ring-slate-200/50 dark:ring-slate-800 overflow-hidden p-0 gap-0">
                    <CardHeader className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 text-left">
                        <CardTitle className="text-base font-semibold">
                          {t('submissionDetail.conversationHistory')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t('submissionDetail.conversationHistoryDesc', { student: studentName })}
                        </CardDescription>
                      </div>
                      {canGenerateAiFeedback ? (
                        <Button
                          type="button"
                          onClick={() => void handleGenerateAiEvaluation()}
                          disabled={generatingAi}
                          className="shrink-0 rounded-xl gap-2"
                        >
                          {generatingAi ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          {t('submissionDetail.generateAiEvaluation.action')}
                        </Button>
                      ) : null}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col overflow-hidden p-0 min-h-0">
                      <div
                        ref={transcriptScrollRef}
                        className="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent"
                      >
                        {liveConversationLoading ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : transcriptMessages.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            {t('submissionDetail.conversationEmpty')}
                          </p>
                        ) : (
                          transcriptMessages.map((msg: Message, idx: number) => {
                            const triggeredAlerts = alerts.flatMap((alert) =>
                              alert.triggered_messages.filter((tm) => tm.message_index === idx)
                            );
                            const isConcerning = triggeredAlerts.length > 0;
                            const isUser = msg.role === 'user';

                            return (
                              <div
                                key={idx}
                                className={`mb-4 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                              >
                                <div
                                  className={`max-w-[85%] p-4 rounded-lg relative shadow-sm ${
                                    isConcerning
                                      ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {isConcerning && (
                                    <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-sm z-10">
                                      <AlertTriangle className="h-3 w-3" />
                                    </div>
                                  )}

                                  {isUser ? (
                                    <SafeMathMarkdown
                                      content={msg.content}
                                      className="text-sm leading-relaxed"
                                    />
                                  ) : (
                                    (() => {
                                      const rawText = String(msg.content || '');
                                      const sentences = splitAssistantMessageIntoSentences(rawText);
                                      if (sentences.length === 0) {
                                        const isHiEmpty =
                                          highlightSentence?.messageIndex === idx &&
                                          highlightSentence?.sentenceIndex === 0;
                                        return (
                                          <div
                                            id={`teacher-chat-sentence-${idx}-0`}
                                            className={cn(
                                              'rounded px-0.5 -mx-0.5 transition-colors duration-300',
                                              isHiEmpty &&
                                                'bg-amber-200/85 dark:bg-amber-900/50 ring-2 ring-amber-400/70 dark:ring-amber-500/60'
                                            )}
                                          >
                                            <SafeMathMarkdown
                                              content={formatInlineListsForChatMarkdown(rawText)}
                                              className="text-sm leading-relaxed"
                                            />
                                          </div>
                                        );
                                      }
                                      return (
                                        <div className="flex flex-col gap-1">
                                          {sentences.map((sentence, si) => {
                                            const isHighlighted =
                                              highlightSentence?.messageIndex === idx &&
                                              highlightSentence?.sentenceIndex === si;
                                            return (
                                              <div
                                                key={si}
                                                id={`teacher-chat-sentence-${idx}-${si}`}
                                                className={cn(
                                                  'rounded px-0.5 -mx-0.5 transition-colors duration-300',
                                                  isHighlighted &&
                                                    'bg-amber-200/85 dark:bg-amber-900/50 ring-2 ring-amber-400/70 dark:ring-amber-500/60'
                                                )}
                                              >
                                                <SafeMathMarkdown
                                                  content={formatInlineListsForChatMarkdown(
                                                    sentence
                                                  )}
                                                  className="text-sm leading-relaxed"
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()
                                  )}

                                  {isConcerning && triggeredAlerts.length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-red-200 dark:border-red-800/50 text-xs text-red-700 dark:text-red-300 bg-red-100/50 dark:bg-red-900/20 -mx-4 -mb-4 p-3 rounded-b-2xl">
                                      <strong>Why flagged:</strong> {triggeredAlerts[0].reason}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1 px-1">
                                  {isUser ? studentName : 'Perleap'}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            }
          }
        })()}
      </TabsContent>

      <TabsContent value="notes" className="mt-6">
        {activeTab === 'notes' ? (
          <SubmissionPrivateNotesTab submissionId={submission.id} isRTL={isRTL} />
        ) : null}
      </TabsContent>
    </Tabs>
  );
};
