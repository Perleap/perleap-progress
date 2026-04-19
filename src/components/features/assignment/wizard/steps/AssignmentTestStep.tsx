import { useTranslation } from 'react-i18next';
import { TestQuestionBuilder, type TestQuestionDraft } from '@/components/features/assignment/TestQuestionBuilder';
import { cn } from '@/lib/utils';

interface AssignmentTestStepProps {
  questions: TestQuestionDraft[];
  onQuestionsChange: (q: TestQuestionDraft[]) => void;
  isRTL: boolean;
  readOnly?: boolean;
  readOnlyMessage?: string;
}

export function AssignmentTestStep({
  questions,
  onQuestionsChange,
  isRTL,
  readOnly = false,
  readOnlyMessage,
}: AssignmentTestStepProps) {
  const { t } = useTranslation();

  if (readOnly) {
    return (
      <div className="space-y-3 p-6 rounded-xl border border-border shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
        <p className={cn('text-sm text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>
          {readOnlyMessage ?? t('createAssignment.wizard.testQuestionsLocked')}
        </p>
        <p className={cn('text-sm font-medium', isRTL ? 'text-right' : 'text-left')}>
          {t('createAssignment.wizard.questionCount', { count: questions.length })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <TestQuestionBuilder questions={questions} onQuestionsChange={onQuestionsChange} />
    </div>
  );
}
