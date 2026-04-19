import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import { Loader2, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface TeacherEvaluationFormProps {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  onEvaluationComplete: () => void;
}

export function TeacherEvaluationForm({
  submissionId,
  studentId,
  assignmentId,
  onEvaluationComplete,
}: TeacherEvaluationFormProps) {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rephrasing, setRephrasing] = useState(false);

  const handleRephraseFeedback = async () => {
    if (!feedback.trim()) {
      toast.error(t('createAssignment.rephraseError'));
      return;
    }

    setRephrasing(true);
    try {
      const { data, error } = await supabase.functions.invoke('rephrase-text', {
        body: {
          text: feedback,
          language: isRTL ? 'he' : 'en',
        },
      });

      if (error) throw error;

      if (data?.rephrasedText) {
        setFeedback(data.rephrasedText);
        toast.success(t('createAssignment.rephraseSuccess'));
      }
    } catch (error) {
      console.error('Error rephrasing evaluation:', error);
      toast.error(t('createAssignment.rephraseError'));
    } finally {
      setRephrasing(false);
    }
  };

  const handleSubmit = async () => {
    if (!feedback.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('evaluate-from-feedback', {
        body: {
          submissionId,
          studentId,
          assignmentId,
          teacherFeedback: feedback.trim(),
          language: language || 'en',
        },
      });

      if (error) throw error;

      toast.success(t('submissionDetail.teacherEvaluation.success'));
      onEvaluationComplete();
    } catch (error) {
      console.error('Evaluation error:', error);
      toast.error(t('submissionDetail.teacherEvaluation.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mt-4 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          {t('submissionDetail.teacherEvaluation.writeEvaluation')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ExpandableTextarea
          key={submissionId}
          value={feedback}
          onChange={setFeedback}
          placeholder={t('submissionDetail.teacherEvaluation.placeholder')}
          className="min-h-[140px]"
          dir={isRTL ? 'rtl' : 'ltr'}
          autoDirection
          disabled={submitting || rephrasing}
          onRewrite={() => void handleRephraseFeedback()}
          isRewriting={rephrasing}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !feedback.trim()}
            className="gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('submissionDetail.teacherEvaluation.submitting')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {t('submissionDetail.teacherEvaluation.submit')}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
