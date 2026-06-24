import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, Trash2, GripVertical, CircleDot, AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  deriveAllowMultipleSelections,
  parseOptionIds,
  toggleOptionId,
} from '@/lib/testMcq';

export interface TestQuestionDraft {
  id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'open_ended';
  options: { id: string; text: string }[];
  correct_option_ids: string[];
  allow_multiple_selections: boolean;
  order_index: number;
}

/** Normalize legacy drafts that still use correct_option_id. */
export function normalizeTestQuestionDraft(
  draft: TestQuestionDraft & { correct_option_id?: string },
): TestQuestionDraft {
  const correct_option_ids =
    draft.correct_option_ids?.length
      ? draft.correct_option_ids
      : parseOptionIds(null, draft.correct_option_id ?? null);
  return {
    ...draft,
    correct_option_ids,
    allow_multiple_selections:
      draft.allow_multiple_selections ?? deriveAllowMultipleSelections(correct_option_ids),
  };
}

export function isTestQuestionDraftValid(question: TestQuestionDraft): boolean {
  if (!question.question_text.trim()) return false;
  if (question.question_type === 'open_ended') return true;
  const filledOptions = question.options.filter((o) => o.text.trim());
  if (filledOptions.length < 2) return false;
  const correctIds = question.correct_option_ids.filter((id) =>
    filledOptions.some((o) => o.id === id),
  );
  return correctIds.length >= 1;
}

export function validateTestQuestionsForPublish(questions: TestQuestionDraft[]): boolean {
  return questions.length >= 1 && questions.every(isTestQuestionDraftValid);
}

interface TestQuestionBuilderProps {
  questions: TestQuestionDraft[];
  onQuestionsChange: (questions: TestQuestionDraft[]) => void;
}

let nextId = 1;
function generateTempId() {
  return `temp_${Date.now()}_${nextId++}`;
}

export function TestQuestionBuilder({ questions, onQuestionsChange }: TestQuestionBuilderProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const addQuestion = () => {
    const newQuestion: TestQuestionDraft = {
      id: generateTempId(),
      question_text: '',
      question_type: 'multiple_choice',
      options: [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
        { id: 'c', text: '' },
        { id: 'd', text: '' },
      ],
      correct_option_ids: [],
      allow_multiple_selections: false,
      order_index: questions.length,
    };
    onQuestionsChange([...questions, newQuestion]);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order_index: i }));
    onQuestionsChange(updated);
  };

  const updateQuestion = (index: number, changes: Partial<TestQuestionDraft>) => {
    const updated = questions.map((q, i) => (i === index ? { ...q, ...changes } : q));
    onQuestionsChange(updated);
  };

  const addOption = (questionIndex: number) => {
    const question = questions[questionIndex];
    const nextLetter = String.fromCharCode(97 + question.options.length);
    const newOptions = [...question.options, { id: nextLetter, text: '' }];
    updateQuestion(questionIndex, { options: newOptions });
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex];
    if (question.options.length <= 2) return;
    const removedId = question.options[optionIndex].id;
    const newOptions = question.options.filter((_, i) => i !== optionIndex);
    const correct_option_ids = question.correct_option_ids.filter((id) => id !== removedId);
    updateQuestion(questionIndex, {
      options: newOptions,
      correct_option_ids,
      allow_multiple_selections: deriveAllowMultipleSelections(correct_option_ids),
    });
  };

  const updateOptionText = (questionIndex: number, optionIndex: number, text: string) => {
    const question = questions[questionIndex];
    const newOptions = question.options.map((o, i) => (i === optionIndex ? { ...o, text } : o));
    updateQuestion(questionIndex, { options: newOptions });
  };

  const toggleCorrectOption = (questionIndex: number, optionId: string, checked: boolean) => {
    const question = questions[questionIndex];
    const correct_option_ids = toggleOptionId(question.correct_option_ids, optionId, checked);
    updateQuestion(questionIndex, {
      correct_option_ids,
      allow_multiple_selections: deriveAllowMultipleSelections(correct_option_ids),
    });
  };

  const toggleQuestionType = (questionIndex: number, type: 'multiple_choice' | 'open_ended') => {
    const updates: Partial<TestQuestionDraft> = { question_type: type };
    if (type === 'open_ended') {
      updates.options = [];
      updates.correct_option_ids = [];
      updates.allow_multiple_selections = false;
    } else if (type === 'multiple_choice') {
      updates.options = [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
        { id: 'c', text: '' },
        { id: 'd', text: '' },
      ];
      updates.correct_option_ids = [];
      updates.allow_multiple_selections = false;
    }
    updateQuestion(questionIndex, updates);
  };

  return (
    <Card className="rounded-xl border-dashed border-2 border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {t('createAssignment.testBuilder.title')}
        </CardTitle>
        <CardDescription>
          {t('createAssignment.testBuilder.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t('createAssignment.testBuilder.noQuestions')}
          </p>
        )}

        {questions.map((question, qIndex) => {
          const correctLabels = question.correct_option_ids
            .map((id) => question.options.find((o) => o.id === id)?.text || id)
            .filter(Boolean);

          return (
            <Card key={question.id} className="rounded-lg">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <GripVertical className="h-5 w-5 mt-2 text-muted-foreground/40 shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t('submissionDetail.testResults.question')} {qIndex + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(qIndex)}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        title={t('createAssignment.testBuilder.removeQuestion')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Textarea
                      value={question.question_text}
                      onChange={(e) => updateQuestion(qIndex, { question_text: e.target.value })}
                      placeholder={t('createAssignment.testBuilder.questionPlaceholder')}
                      className="min-h-[60px] resize-none rounded-lg"
                      dir={isRTL ? 'rtl' : 'ltr'}
                    />

                    <div className="flex flex-wrap items-center gap-3">
                      <Label className="text-xs text-muted-foreground">
                        {t('createAssignment.testBuilder.questionType')}:
                      </Label>
                      <ToggleGroup
                        variant="outline"
                        size="sm"
                        spacing={0}
                        value={[question.question_type]}
                        onValueChange={(vals) => {
                          const v = vals[0];
                          if (v === 'multiple_choice' || v === 'open_ended') {
                            toggleQuestionType(qIndex, v);
                          }
                        }}
                      >
                        <ToggleGroupItem
                          value="multiple_choice"
                          aria-label={t('createAssignment.testBuilder.multipleChoice')}
                          className="h-7 gap-1 px-2.5 text-xs min-h-7 [&_svg:not([class*='size-'])]:size-3"
                        >
                          <CircleDot className="h-3 w-3 shrink-0" />
                          {t('createAssignment.testBuilder.multipleChoice')}
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="open_ended"
                          aria-label={t('createAssignment.testBuilder.openEnded')}
                          className="h-7 gap-1 px-2.5 text-xs min-h-7 [&_svg:not([class*='size-'])]:size-3"
                        >
                          <AlignLeft className="h-3 w-3 shrink-0" />
                          {t('createAssignment.testBuilder.openEnded')}
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    {question.question_type === 'multiple_choice' && (
                      <div className="space-y-2 ps-2">
                        <p className="text-xs text-muted-foreground">
                          {t('createAssignment.testBuilder.markCorrectOptions')}
                        </p>
                        {question.options.map((option, oIndex) => (
                          <div key={option.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`${question.id}-${option.id}-correct`}
                              checked={question.correct_option_ids.includes(option.id)}
                              onCheckedChange={(checked) =>
                                toggleCorrectOption(qIndex, option.id, checked === true)
                              }
                            />
                            <Input
                              value={option.text}
                              onChange={(e) => updateOptionText(qIndex, oIndex, e.target.value)}
                              placeholder={t('createAssignment.testBuilder.optionPlaceholder', {
                                index: oIndex + 1,
                              })}
                              className={cn('h-8 text-sm rounded-lg flex-1', isRTL && 'text-right')}
                              dir={isRTL ? 'rtl' : 'ltr'}
                            />
                            {question.options.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOption(qIndex, oIndex)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                title={t('createAssignment.testBuilder.removeOption')}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addOption(qIndex)}
                          className="h-7 text-xs gap-1 text-primary"
                        >
                          <Plus className="h-3 w-3" />
                          {t('createAssignment.testBuilder.addOption')}
                        </Button>
                        {correctLabels.length > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            {correctLabels.length > 1
                              ? t('createAssignment.testBuilder.correctAnswers')
                              : t('createAssignment.testBuilder.correctAnswer')}
                            : {correctLabels.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {question.question_type === 'open_ended' && (
                      <div className="ps-2">
                        <p className="text-xs text-muted-foreground italic">
                          {t('createAssignment.testBuilder.openEnded')} — {t('assignmentDetail.testTaking.typeAnswer')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Button
          type="button"
          variant="outline"
          onClick={addQuestion}
          className="w-full rounded-lg border-dashed gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('createAssignment.testBuilder.addQuestion')}
        </Button>
      </CardContent>
    </Card>
  );
}
