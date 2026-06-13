import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Save } from 'lucide-react';
import { useState, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { AssignmentCompletionTone } from '@/types/submission';
import type { Edge, Node } from '@xyflow/react';
import type { TFunction } from 'i18next';
import {
  LangchainEditor,
  type LangchainEditorHandle,
} from '@/components/features/langchain/LangchainEditor';
import {
  parsePipelineJson,
  serializePipeline,
  validateLangchainPipeline,
  type LangchainPipelineValidationIssue,
} from '@/components/features/langchain/langchainNodeData';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { assignmentKeys } from '@/hooks/queries';
import { supabase } from '@/integrations/supabase/client';
import { completeSubmission, submitWithBackgroundAiFeedback } from '@/services/submissionService';
import { getAssignmentLanguage } from '@/utils/languageDetection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';

function toastValidationIssues(t: TFunction, issues: LangchainPipelineValidationIssue[]) {
  const order: LangchainPipelineValidationIssue[] = [
    'emptyGraph',
    'noStartToOutputPath',
    'emailSendToRequired',
  ];
  for (const key of order) {
    if (issues.includes(key)) {
      toast.error(t(`assignmentDetail.langchain.validation.${key}`));
      return;
    }
  }
}

interface LangchainBuilderPageProps {
  assignmentId: string;
  submissionId: string;
  assignmentInstructions: string;
  /** Saved pipeline JSON from `submissions.text_body` (legacy or v1 envelope). */
  initialPipelineText?: string | null;
  /** When false, student submit does not run AI; teacher can generate evaluation later. */
  enableAiFeedback?: boolean;
  /** When false after generation, student waits for teacher to release feedback. */
  showAiFeedbackToStudents?: boolean;
  /** Teacher "Try assignment" — skip AI feedback. */
  isTeacherTry?: boolean;
  onComplete: (tone?: AssignmentCompletionTone) => void | Promise<void>;
}

export const LangchainBuilderPage = ({
  assignmentId,
  submissionId,
  assignmentInstructions,
  initialPipelineText,
  enableAiFeedback = true,
  showAiFeedbackToStudents = true,
  isTeacherTry = false,
  onComplete,
}: LangchainBuilderPageProps) => {
  const { t } = useTranslation();
  const { language: uiLanguage = 'en' } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const editorRef = useRef<LangchainEditorHandle | null>(null);

  const [initialNodes, setInitialNodes] = useState<Node[]>([]);
  const [initialEdges, setInitialEdges] = useState<Edge[]>([]);
  /** Bumps after parsing `initialPipelineText` so React Flow remounts with hydrated nodes (useNodesState only reads initial on mount). */
  const [hydrationVersion, setHydrationVersion] = useState(0);
  const [nodeCount, setNodeCount] = useState(0);

  useLayoutEffect(() => {
    const { nodes: n, edges: e } = parsePipelineJson(initialPipelineText);
    setInitialNodes(n);
    setInitialEdges(e);
    setNodeCount(n.length);
    setHydrationVersion((v) => v + 1);
  }, [initialPipelineText]);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const readPipeline = () => editorRef.current?.getPipeline() ?? { nodes: [], edges: [] };

  const savePipeline = async () => {
    setSaving(true);
    try {
      const { nodes, edges } = readPipeline();
      const pipelineData = serializePipeline(nodes, edges);
      const { error } = await supabase
        .from('submissions')
        .update({ text_body: pipelineData })
        .eq('id', submissionId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: assignmentKeys.detail(assignmentId) });
      toast.success(t('assignmentDetail.langchain.save'));
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const { nodes, edges } = readPipeline();
    const { ok, issues } = validateLangchainPipeline(nodes, edges);
    if (!ok) {
      toastValidationIssues(t, issues);
      return;
    }

    setSubmitting(true);
    try {
      const pipelineData = serializePipeline(nodes, edges);
      await supabase.from('submissions').update({ text_body: pipelineData }).eq('id', submissionId);

      if (isTeacherTry) {
        const { error } = await completeSubmission(submissionId);
        if (error) throw error;
        await onComplete('activityCompleted');
        return;
      }

      if (!enableAiFeedback) {
        const { error } = await completeSubmission(submissionId);
        if (error) throw error;
        await onComplete('awaitingReview');
        return;
      }

      if (!user?.id) {
        toast.error(t('common.error'));
        return;
      }

      const language = getAssignmentLanguage(assignmentInstructions, uiLanguage);
      const { error: submitError, evaluationInvokeFailed } = await submitWithBackgroundAiFeedback({
        submissionId,
        studentId: user.id,
        assignmentId,
        language,
      });
      if (submitError) throw submitError;
      if (evaluationInvokeFailed) {
        toast.warning(t('assignmentDetail.errors.generatingFeedbackButCompleted'));
      }

      await onComplete(showAiFeedbackToStudents ? 'activityCompleted' : 'awaitingTeacher');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const canPersist = nodeCount > 0;

  return (
    <Card size="sm" className="gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="border-b bg-muted/30 px-4 py-3 [.border-b]:pb-3">
        <CardTitle>{t('assignmentDetail.langchain.buildPipeline')}</CardTitle>
        <CardAction>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={savePipeline}
              disabled={saving || !canPersist}
              className="h-9 gap-1.5 rounded-full shadow-xs"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('assignmentDetail.langchain.save')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !canPersist}
              className="h-9 gap-1.5 rounded-full shadow-md"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('assignmentDetail.langchain.submitting')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('assignmentDetail.langchain.submit')}
                </>
              )}
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[min(72vh,820px)] min-h-[560px] border-t">
          <LangchainEditor
            ref={editorRef}
            key={hydrationVersion}
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            onNodeCountChange={setNodeCount}
          />
        </div>
      </CardContent>
    </Card>
  );
};
