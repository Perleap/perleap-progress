import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CircleDot, AlignLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useTestQuestions, useSubmitTestResponses } from '@/hooks/queries';
import { generateFeedback, completeSubmission } from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { assignmentKeys } from '@/hooks/queries';

interface TestTakingPageProps {
  assignmentId: string;
  assignmentInstructions: string;
  submissionId: string;
  autoPublishAiFeedback?: boolean;
  onComplete: () => void;
}

export function TestTakingPage({
  assignmentId,
  assignmentInstructions,
  submissionId,
  autoPublishAiFeedback = true,
  onComplete,
}: TestTakingPageProps) {
  const { t } = useTranslation();
  const { isRTL, language: uiLanguage = 'en' } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: questions, isLoading } = useTestQuestions(assignmentId);
  const submitResponses = useSubmitTestResponses();

  const [answers, setAnswers] = useState<Record<string, { selected_option_id?: string; text_answer?: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateAnswer = (questionId: string, value: { selected_option_id?: string; text_answer?: string }) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...value } }));
  };

  const handleSubmit = async () => {
    if (!questions || !user) return;

    const unanswered = questions.filter((q) => {
      const answer = answers[q.id];
      if (!answer) return true;
      if (q.question_type === 'multiple_choice' && !answer.selected_option_id) return true;
      if (q.question_type === 'open_ended' && !answer.text_answer?.trim()) return true;
      return false;
    });

    if (unanswered.length > 0) {
      toast.error(t('assignmentDetail.testTaking.allQuestionsRequired'));
      return;
    }

    if (!window.confirm(t('assignmentDetail.testTaking.confirmSubmit'))) return;

    setSubmitting(true);
    try {
      const responses = questions.map((q) => ({
        question_id: q.id,
        selected_option_id: answers[q.id]?.selected_option_id,
        text_answer: answers[q.id]?.text_answer,
      }));

      await submitResponses.mutateAsync({ submissionId, responses });

      if (!autoPublishAiFeedback) {
        const { error: completeError } = await completeSubmission(submissionId, {
          awaitingTeacherFeedbackRelease: true,
        });
        if (completeError) {
          console.error('Error completing submission:', completeError);
          toast.error(t('assignmentDetail.testTaking.submitError'));
        } else {
          toast.success(t('assignmentDetail.success.submittedAwaitingTeacher'));
          queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
          onComplete();
        }
      } else {
        const language = getAssignmentLanguage(assignmentInstructions, uiLanguage);
        const { error: feedbackError } = await generateFeedback({
          submissionId,
          studentId: user.id,
          assignmentId,
          language,
        });

        if (feedbackError) {
          console.error('Error generating feedback:', feedbackError);
          toast.error(t('assignmentDetail.testTaking.submitError'));
        } else {
          await completeSubmission(submissionId);
          toast.success(t('assignmentDetail.testTaking.submitSuccess'));
          queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
          onComplete();
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
        return (
          <Card key={question.id} className="overflow-hidden">
            <CardHeader className="pb-3 bg-transparent">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0">
                  {t('assignmentDetail.testTaking.question', { number: index + 1 })}
                </Badge>
                {question.question_type === 'multiple_choice' ? (
                  <CircleDot className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <AlignLeft className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <p className={`text-sm font-medium mt-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                {question.question_text}
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {question.question_type === 'multiple_choice' ? (
                <RadioGroup
                  value={answers[question.id]?.selected_option_id || ''}
                  onValueChange={(val) => updateAnswer(question.id, { selected_option_id: val })}
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
              ) : (
                <Textarea
                  value={answers[question.id]?.text_answer || ''}
                  onChange={(e) => updateAnswer(question.id, { text_answer: e.target.value })}
                  placeholder={t('assignmentDetail.testTaking.typeAnswer')}
                  className="min-h-[100px] resize-none"
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end pt-4 pb-8">
        <Button
          onClick={handleSubmit}
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
  );
}
