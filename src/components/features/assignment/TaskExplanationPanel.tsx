import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type TaskExplanationPanelProps = {
  studentFacingTask: string | null | undefined;
  taskLoading?: boolean;
  onContinue: () => void;
};

export function TaskExplanationPanel({
  studentFacingTask,
  taskLoading = false,
  onContinue,
}: TaskExplanationPanelProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const taskText = studentFacingTask?.trim() ?? '';

  return (
    <Card className="border-primary/25 bg-primary/5" dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader className={cn('py-3', isRTL && 'text-end')}>
        <CardTitle className="text-sm font-medium">{t('taskUnderstanding.explanationPanelTitle')}</CardTitle>
      </CardHeader>
      <CardContent className={cn('space-y-4 pt-0 text-sm', isRTL && 'text-end')}>
        {taskLoading ? (
          <p className="flex items-center gap-2 text-muted-foreground" dir="auto">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            {t('assignmentDetail.loadingStudentTask')}
          </p>
        ) : taskText ? (
          <p className="whitespace-pre-wrap leading-relaxed text-foreground" dir="auto">
            {taskText}
          </p>
        ) : (
          <p className="text-muted-foreground leading-relaxed" dir="auto">
            {t('assignmentDetail.studentTaskNotSetYet')}
          </p>
        )}
        <p className="text-muted-foreground leading-relaxed">{t('taskUnderstanding.explanationPanelBody')}</p>
        <Button type="button" onClick={onContinue} className={cn(isRTL && 'self-end')}>
          {t('taskUnderstanding.continueToAssignment')}
        </Button>
      </CardContent>
    </Card>
  );
}
