import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generateFeedback, completeSubmission } from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { assignmentKeys } from '@/hooks/queries';
import type { AssignmentCompletionTone } from '@/types/submission';

const AUTOSAVE_MS = 1200;

interface EssaySubmissionPageProps {
  assignmentId: string;
  submissionId: string;
  assignmentInstructions: string;
  /** When false, student submit does not run AI; teacher runs evaluation later. */
  autoPublishAiFeedback?: boolean;
  /** Teacher "Try assignment" — skip AI feedback (edge function writes assume student_profiles). */
  isTeacherTry?: boolean;
  initialText?: string | null;
  onComplete: (tone?: AssignmentCompletionTone) => void | Promise<void>;
}

export function EssaySubmissionPage({
  assignmentId,
  submissionId,
  assignmentInstructions,
  autoPublishAiFeedback = true,
  isTeacherTry = false,
  initialText,
  onComplete,
}: EssaySubmissionPageProps) {
  const { t } = useTranslation();
  const { language: uiLanguage = 'en' } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [text, setText] = useState(initialText ?? '');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(initialText ?? '');
  }, [initialText]);

  const persistText = useCallback(
    async (body: string) => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('submissions')
          .update({ text_body: body })
          .eq('id', submissionId);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: assignmentKeys.detail(assignmentId) });
      } catch (e) {
        console.error('Essay autosave error:', e);
      } finally {
        setSaving(false);
      }
    },
    [submissionId, assignmentId, queryClient],
  );

  const onTextChange = (value: string) => {
    setText(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persistText(value);
    }, AUTOSAVE_MS);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error(t('essaySubmission.empty'));
      return;
    }
    if (!user?.id) {
      toast.error(t('common.error'));
      return;
    }

    setSubmitting(true);
    try {
      const { error: saveErr } = await supabase
        .from('submissions')
        .update({ text_body: trimmed })
        .eq('id', submissionId);
      if (saveErr) throw saveErr;

      if (isTeacherTry) {
        const { error: completeError } = await completeSubmission(submissionId);
        if (completeError) throw completeError;
        toast.success(t('teacherTry.previewMarkedComplete'));
        await onComplete('activityCompleted');
        return;
      }

      if (!autoPublishAiFeedback) {
        const { error: completeError } = await completeSubmission(submissionId, {
          awaitingTeacherFeedbackRelease: true,
        });
        if (completeError) throw completeError;

        await onComplete('awaitingTeacher');
        return;
      }

      const language = getAssignmentLanguage(assignmentInstructions, uiLanguage);
      const { error: feedbackError } = await generateFeedback({
        submissionId,
        studentId: user.id,
        assignmentId,
        language,
      });
      if (feedbackError) throw feedbackError;

      const { error: completeError } = await completeSubmission(submissionId);
      if (completeError) throw completeError;

      await onComplete('activityCompleted');
    } catch (e) {
      console.error('Essay submit error:', e);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden border-primary/15">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">{t('essaySubmission.title')}</CardTitle>
          {saving && (
            <span className="text-xs text-muted-foreground">{t('essaySubmission.saving')}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={t('essaySubmission.placeholder')}
          className="min-h-[28rem] text-base leading-relaxed resize-y rounded-xl border-muted-foreground/20"
          disabled={submitting}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="lg"
            className="rounded-xl gap-2"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t('essaySubmission.submit')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
