import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, CheckCircle, Sparkles } from 'lucide-react';
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
  const [originalFeedback, setOriginalFeedback] = useState<string | null>(null);

  const handleRephraseFeedback = async () => {
    if (!feedback.trim()) {
      toast.error(t('createAssignment.rephraseError'));
      return;
    }

    setRephrasing(true);
    setOriginalFeedback(feedback);
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
        <div className={`flex flex-wrap items-center gap-2 justify-end ${isRTL ? 'flex-row-reverse' : ''}`}>
          {originalFeedback !== null && originalFeedback !== feedback && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFeedback(originalFeedback);
                setOriginalFeedback(null);
              }}
              className="rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {t('common.undo')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRephraseFeedback}
            disabled={!feedback.trim() || rephrasing || submitting}
            className={`rounded-full text-xs font-semibold gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {rephrasing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('createAssignment.rephrasing')}
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                {t('createAssignment.rephraseButton')}
              </>
            )}
          </Button>
        </div>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={t('submissionDetail.teacherEvaluation.placeholder')}
          className="min-h-[140px] resize-y"
          disabled={submitting || rephrasing}
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
