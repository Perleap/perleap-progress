import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

interface RegenerateScoresButtonProps {
  classroomId: string;
  onComplete: () => void;
}

export function RegenerateScoresButton({ classroomId, onComplete }: RegenerateScoresButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const regenerateAllScores = async () => {
    setLoading(true);
    try {
      // Get all assignments in this classroom
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('classroom_id', classroomId);

      if (!assignments || assignments.length === 0) {
        toast.info(t('analytics.noAssignments'));
        setLoading(false);
        return;
      }

      const assignmentIds = assignments.map((a) => a.id);

      // Get all submissions with feedback (completed assignments)
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id')
        .in('assignment_id', assignmentIds);

      if (!submissions || submissions.length === 0) {
        toast.info(t('analytics.noCompletedSubmissions'));
        setLoading(false);
        return;
      }

      // Filter to only submissions with feedback
      const { data: feedbackData } = await supabase
        .from('assignment_feedback')
        .select('submission_id')
        .in(
          'submission_id',
          submissions.map((s) => s.id)
        );

      const completedSubmissionIds = feedbackData?.map((f) => f.submission_id) || [];

      if (completedSubmissionIds.length === 0) {
        toast.info(t('analytics.noCompletedSubmissions'));
        setLoading(false);
        return;
      }

      // Regenerate scores for each submission
      let successCount = 0;
      let failCount = 0;

      for (const submissionId of completedSubmissionIds) {
        try {
          const { error } = await supabase.functions.invoke('regenerate-scores', {
            body: { submissionId },
          });

          if (error) {
            failCount++;
          } else {
            successCount++;
          }
        } catch (e) {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(t('analytics.regenerateSuccess', { count: successCount }));
        onComplete();
      }

      if (failCount > 0) {
        toast.error(t('analytics.regenerateFail', { count: failCount }));
      }
    } catch (error) {
      toast.error(t('analytics.regenerateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={regenerateAllScores} disabled={loading}>
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Regenerating...' : 'Regenerate All 5D Scores'}
    </Button>
  );
}
