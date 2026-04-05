import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, CircleDot, AlignLeft, Loader2 } from 'lucide-react';
import { useTestQuestions, useTestResponses } from '@/hooks/queries';
import { cn } from '@/lib/utils';

interface TestResultsViewProps {
  assignmentId: string;
  submissionId: string;
}

export function TestResultsView({ assignmentId, submissionId }: TestResultsViewProps) {
  const { t } = useTranslation();
  const { data: questions, isLoading: loadingQuestions } = useTestQuestions(assignmentId);
  const { data: responses, isLoading: loadingResponses } = useTestResponses(submissionId);

  if (loadingQuestions || loadingResponses) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No test questions found.
        </CardContent>
      </Card>
    );
  }

  const responseMap = new Map(
    (responses || []).map((r) => [r.question_id, r])
  );

  const mcqQuestions = questions.filter((q) => q.question_type === 'multiple_choice');
  const mcqCorrect = mcqQuestions.filter((q) => {
    const response = responseMap.get(q.id);
    return response?.selected_option_id === q.correct_option_id;
  }).length;
  const openEndedCount = questions.filter((q) => q.question_type === 'open_ended').length;

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('submissionDetail.testResults.title')}</CardTitle>
          <CardDescription>{t('submissionDetail.testResults.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {mcqQuestions.length > 0 && (
              <div className="flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {t('submissionDetail.testResults.mcqScore')}:
                </span>
                <Badge variant={mcqCorrect === mcqQuestions.length ? 'default' : 'secondary'}>
                  {t('submissionDetail.testResults.summary', {
                    correct: mcqCorrect,
                    total: mcqQuestions.length,
                  })}
                </Badge>
              </div>
            )}
            {openEndedCount > 0 && (
              <div className="flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {t('submissionDetail.testResults.openEndedCount')}:
                </span>
                <Badge variant="outline">{openEndedCount}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {questions.map((question, index) => {
        const response = responseMap.get(question.id);
        const options = (question.options as { id: string; text: string }[] | null) || [];
        const isCorrect =
          question.question_type === 'multiple_choice' &&
          response?.selected_option_id === question.correct_option_id;

        return (
          <Card key={question.id} className="overflow-hidden">
            <CardHeader className="pb-3 bg-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0">
                    {t('submissionDetail.testResults.question')} {index + 1}
                  </Badge>
                  {question.question_type === 'multiple_choice' ? (
                    <CircleDot className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <AlignLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {question.question_type === 'multiple_choice' && response && (
                  isCorrect ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {t('submissionDetail.testResults.correct')}
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                      <XCircle className="h-3 w-3 mr-1" />
                      {t('submissionDetail.testResults.incorrect')}
                    </Badge>
                  )
                )}
              </div>
              <p className="text-sm font-medium mt-2">{question.question_text}</p>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {question.question_type === 'multiple_choice' ? (
                <div className="space-y-2">
                  {options.map((option) => {
                    const isSelected = response?.selected_option_id === option.id;
                    const isCorrectOption = question.correct_option_id === option.id;

                    return (
                      <div
                        key={option.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border text-sm',
                          isCorrectOption && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
                          isSelected && !isCorrectOption && 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
                          !isSelected && !isCorrectOption && 'bg-muted/30 border-transparent'
                        )}
                      >
                        {isCorrectOption && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                        {isSelected && !isCorrectOption && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                        {!isSelected && !isCorrectOption && <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                        <span className={cn(
                          isCorrectOption && 'font-medium text-green-700 dark:text-green-300',
                          isSelected && !isCorrectOption && 'text-red-700 dark:text-red-300',
                        )}>
                          {option.text}
                        </span>
                        {isSelected && (
                          <Badge variant="outline" className="ml-auto text-xs">
                            {t('submissionDetail.testResults.studentAnswer')}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('submissionDetail.testResults.studentAnswer')}:
                  </p>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">
                    {response?.text_answer || (
                      <span className="text-muted-foreground italic">
                        {t('submissionDetail.testResults.noAnswer')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
