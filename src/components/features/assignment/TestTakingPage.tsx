import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
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
<<<<<<< HEAD
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem, ToggleDot } from '@/components/ui/radio-group';
=======
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
>>>>>>> bugs_during_course
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CircleDot, AlignLeft, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { useTestQuestions, useSubmitTestResponses } from '@/hooks/queries';
import { submitWithBackgroundAiFeedback, completeSubmission } from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { useAuth } from '@/contexts/useAuth';
import type { AssignmentCompletionTone } from '@/types/submission';
import { TrackedTextarea } from '@/components/ui/tracked-textarea';
import type { AssignmentClipboardTrackingCallbacks } from '@/hooks/useAssignmentClipboardTracking';
import type { NuanceTrackingCallbacks } from '@/hooks/useNuanceTracking';
import { isMultiSelectMcq, toggleOptionId } from '@/lib/testMcq';

interface TestTakingPageProps {
  assignmentId: string;
  assignmentInstructions: string;
  submissionId: string;
  /** When false, student submit does not run AI; teacher can generate evaluation later. */
  enableAiFeedback?: boolean;
  /** When false after generation, student waits for teacher to release feedback. */
  showAiFeedbackToStudents?: boolean;
  /** Teacher "Try assignment" — skip AI feedback (edge function writes assume student_profiles). */
  isTeacherTry?: boolean;
  nuanceTracking?: NuanceTrackingCallbacks;
  clipboardTracking?: AssignmentClipboardTrackingCallbacks;
  onComplete: (tone?: AssignmentCompletionTone) => void | Promise<void>;
}

type TestAnswer = {
  selected_option_ids?: string[];
  text_answer?: string;
};

export function TestTakingPage({
  assignmentId,
  assignmentInstructions,
  submissionId,
  enableAiFeedback = true,
  showAiFeedbackToStudents = true,
  isTeacherTry = false,
  nuanceTracking,
  clipboardTracking,
  onComplete,
}: TestTakingPageProps) {
  const { t } = useTranslation();
  const { isRTL, language: uiLanguage = 'en' } = useLanguage();
<<<<<<< HEAD
  const { user, loading: authLoading } = useAuth();
=======
  const { user } = useAuth();
  const hasTrackedFirstInteraction = useRef(false);

  const trackFirstInteraction = () => {
    if (hasTrackedFirstInteraction.current || !nuanceTracking) return;
    hasTrackedFirstInteraction.current = true;
    nuanceTracking.trackResponseStarted(0);
  };
>>>>>>> bugs_during_course

  const {
    data: questions,
    isLoading,
    isError: questionsError,
    refetch: refetchQuestions,
  } = useTestQuestions(assignmentId, {
    forStudent: !isTeacherTry,
  });
  const submitResponses = useSubmitTestResponses();

  const [answers, setAnswers] = useState<Record<string, TestAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const updateAnswer = (questionId: string, value: TestAnswer) => {
    trackFirstInteraction();
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...value } }));
  };

  const isMcqAnswered = (
    question: { question_type: string; allow_multiple_selections?: boolean | null },
    answer: TestAnswer | undefined,
  ) => {
    if (!answer) return false;
    if (question.question_type !== 'multiple_choice') return false;
    const selected = answer.selected_option_ids ?? [];
    if (isMultiSelectMcq(question.allow_multiple_selections)) {
      return selected.length > 0;
    }
    return selected.length === 1;
  };

  const requestSubmit = () => {
    if (!user) {
      if (!authLoading) {
        toast.error(t('assignmentDetail.testTaking.sessionExpired'));
      }
      return;
    }
    if (!questions) {
      toast.error(t('assignmentDetail.testTaking.questionsNotLoaded'));
      return;
    }

    const unanswered = questions.filter((q) => {
      const answer = answers[q.id];
      if (q.question_type === 'multiple_choice') return !isMcqAnswered(q, answer);
      if (q.question_type === 'open_ended') return !answer?.text_answer?.trim();
      return true;
    });

    if (unanswered.length > 0) {
      toast.error(t('assignmentDetail.testTaking.allQuestionsRequired'));
      return;
    }

    setConfirmOpen(true);
  };

  const performSubmit = async () => {
    if (!questions || !user) return;

    setSubmitting(true);
    try {
      const responses = questions.map((q) => ({
        question_id: q.id,
        selected_option_ids: answers[q.id]?.selected_option_ids ?? [],
        text_answer: answers[q.id]?.text_answer,
      }));

      await submitResponses.mutateAsync({ submissionId, responses });

      if (isTeacherTry) {
        const { error: completeError } = await completeSubmission(submissionId);
        if (completeError) {
          console.error('Error completing submission:', completeError);
          toast.error(t('assignmentDetail.testTaking.submitError'));
        } else {
          toast.success(t('teacherTry.previewMarkedComplete'));
          await onComplete('testSubmitted');
        }
        return;
      }

      if (!enableAiFeedback) {
        const { error: completeError } = await completeSubmission(submissionId);
        if (completeError) {
          console.error('Error completing submission:', completeError);
          toast.error(t('assignmentDetail.testTaking.submitError'));
        } else {
          await onComplete('testSubmitted');
        }
      } else {
        const language = getAssignmentLanguage(assignmentInstructions, uiLanguage);
        const { error: submitError, evaluationInvokeFailed } = await submitWithBackgroundAiFeedback({
          submissionId,
          studentId: user.id,
          assignmentId,
          language,
        });

        if (submitError) {
          console.error('Error completing submission:', submitError);
          toast.error(t('assignmentDetail.testTaking.submitError'));
        } else {
          if (evaluationInvokeFailed) {
            toast.warning(t('assignmentDetail.errors.generatingFeedbackButCompleted'));
          }
          await onComplete(showAiFeedbackToStudents ? 'testSubmitted' : 'awaitingTeacher');
        }
      }
    } catch (error) {
      console.error('Error submitting test:', error);
      toast.error(t('assignmentDetail.testTaking.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (questionsError) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">
            {t('assignmentDetail.testTaking.questionsLoadError')}
          </p>
          <Button type="button" variant="outline" onClick={() => void refetchQuestions()}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No test questions available for this assignment.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('assignmentDetail.testTaking.submitTest')}</AlertDialogTitle>
            <AlertDialogDescription>{t('assignmentDetail.testTaking.confirmSubmit')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                void performSubmit();
              }}
            >
              {t('common.submit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
      {questions.map((question, index) => {
        const options = (question.options as { id: string; text: string }[] | null) || [];
        const multiSelect = isMultiSelectMcq(question.allow_multiple_selections);
        const selectedIds = answers[question.id]?.selected_option_ids ?? [];

        return (
          <Card key={question.id} className="overflow-hidden">
            <CardHeader className="pb-3 bg-transparent">
              <Badge
                variant="secondary"
                className="shrink-0 rounded-full gap-1.5 px-2.5 py-0.5 font-medium text-muted-foreground"
              >
                {question.question_type === 'multiple_choice' ? (
                  multiSelect ? (
                    <ListChecks className="size-3 shrink-0" />
                  ) : (
                    <CircleDot className="size-3 shrink-0" />
                  )
                ) : (
                  <AlignLeft className="size-3 shrink-0" />
                )}
                {t('assignmentDetail.testTaking.question', { number: index + 1 })}
              </Badge>
              <p className={`text-sm font-medium mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {question.question_text}
              </p>
              {question.question_type === 'multiple_choice' && multiSelect && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('assignmentDetail.testTaking.selectAllThatApply')}
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {question.question_type === 'multiple_choice' ? (
                multiSelect ? (
                  <div className="space-y-2" dir={isRTL ? 'rtl' : 'ltr'}>
                    {options.map((option) => (
                      <label
                        key={option.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          const nextChecked = !selectedIds.includes(option.id);
                          updateAnswer(question.id, {
                            selected_option_ids: toggleOptionId(
                              selectedIds,
                              option.id,
                              nextChecked,
                            ),
                          });
                        }}
                      >
                        <ToggleDot
                          checked={selectedIds.includes(option.id)}
                          className="shrink-0"
                        />
                        <span className="flex-1 text-sm leading-normal">{option.text}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <RadioGroup
                    value={selectedIds[0] || ''}
                    onValueChange={(val) =>
                      updateAnswer(question.id, { selected_option_ids: val ? [val] : [] })
                    }
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    <div className="space-y-2">
                      {options.map((option) => (
                        <label
                          key={option.id}
                          htmlFor={`${question.id}-${option.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          <RadioGroupItem
                            value={option.id}
                            id={`${question.id}-${option.id}`}
                            className="shrink-0"
                          />
                          <span className="flex-1 text-sm leading-normal">{option.text}</span>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                )
              ) : (
                <TrackedTextarea
                  value={answers[question.id]?.text_answer || ''}
                  onChange={(e) => updateAnswer(question.id, { text_answer: e.target.value })}
                  placeholder={t('assignmentDetail.testTaking.typeAnswer')}
                  className="min-h-[100px] resize-none"
                  dir={isRTL ? 'rtl' : 'ltr'}
                  clipboardTracking={clipboardTracking}
                  pasteSourceKind="test_answer"
                  pasteContextKey={question.id}
                  copySourceKind="test_answer"
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end pt-4 pb-8">
        <Button
          onClick={requestSubmit}
          disabled={submitting}
          title={
            !user && !authLoading
              ? t('assignmentDetail.testTaking.sessionExpired')
              : !questions && (!isLoading || questionsError)
                ? t('assignmentDetail.testTaking.questionsNotLoaded')
                : undefined
          }
          size="lg"
          className="gap-2 rounded-full shadow-md"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('assignmentDetail.testTaking.submitting')}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {t('assignmentDetail.testTaking.submitTest')}
            </>
          )}
        </Button>
      </div>
      </div>
    </>
  );
}
