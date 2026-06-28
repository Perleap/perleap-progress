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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  const { user } = useAuth();
  const hasTrackedFirstInteraction = useRef(false);

  const trackFirstInteraction = () => {
    if (hasTrackedFirstInteraction.current || !nuanceTracking) return;
    hasTrackedFirstInteraction.current = true;
    nuanceTracking.trackResponseStarted(0);
  };

  const { data: questions, isLoading } = useTestQuestions(assignmentId, { forStudent: true });
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
    if (!questions || !user) return;

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
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t('assignmentDetail.testTaking.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {questions.length} {t('submissionDetail.testResults.question').toLowerCase()}
            {questions.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      {questions.map((question, index) => {
        const options = (question.options as { id: string; text: string }[] | null) || [];
        const multiSelect = isMultiSelectMcq(question.allow_multiple_selections);
        const selectedIds = answers[question.id]?.selected_option_ids ?? [];

        return (
          <Card key={question.id} className="overflow-hidden">
            <CardHeader className="pb-3 bg-transparent">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0">
                  {t('assignmentDetail.testTaking.question', { number: index + 1 })}
                </Badge>
                {question.question_type === 'multiple_choice' ? (
                  multiSelect ? (
                    <ListChecks className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <CircleDot className="h-4 w-4 text-muted-foreground" />
                  )
                ) : (
                  <AlignLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
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
                      <div
                        key={option.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          id={`${question.id}-${option.id}`}
                          checked={selectedIds.includes(option.id)}
                          onCheckedChange={(checked) =>
                            updateAnswer(question.id, {
                              selected_option_ids: toggleOptionId(
                                selectedIds,
                                option.id,
                                checked === true,
                              ),
                            })
                          }
                        />
                        <Label
                          htmlFor={`${question.id}-${option.id}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          {option.text}
                        </Label>
                      </div>
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
                        <div key={option.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value={option.id} id={`${question.id}-${option.id}`} />
                          <Label
                            htmlFor={`${question.id}-${option.id}`}
                            className="flex-1 cursor-pointer text-sm"
                          >
                            {option.text}
                          </Label>
                        </div>
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
