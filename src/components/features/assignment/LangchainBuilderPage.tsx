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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { assignmentKeys } from '@/hooks/queries';
import { supabase } from '@/integrations/supabase/client';
import { completeSubmission } from '@/services/submissionService';

function toastValidationIssues(t: TFunction, issues: LangchainPipelineValidationIssue[]) {
  const order: LangchainPipelineValidationIssue[] = [
    'emptyGraph',
    'noInputToOutputPath',
    'promptTemplateRequired',
    'llmModelRequired',
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
  /** Saved pipeline JSON from `submissions.text_body` (legacy or v1 envelope). */
  initialPipelineText?: string | null;
  onComplete: (tone?: AssignmentCompletionTone) => void | Promise<void>;
}

export const LangchainBuilderPage = ({
  assignmentId,
  submissionId,
  initialPipelineText,
  onComplete,
}: LangchainBuilderPageProps) => {
  const { t } = useTranslation();
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

      const { error } = await completeSubmission(submissionId);
      if (error) throw error;

      await onComplete('awaitingReview');
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const canPersist = nodeCount > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{t('assignmentDetail.langchain.buildPipeline')}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={savePipeline}
              disabled={saving || !canPersist}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {t('assignmentDetail.langchain.save')}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !canPersist}
              className="gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('assignmentDetail.langchain.submitting')}
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  {t('assignmentDetail.langchain.submit')}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[600px] border-t min-h-[480px]">
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
