import { useState, useCallback, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { completeSubmission } from '@/services/submissionService';
import { useQueryClient } from '@tanstack/react-query';
import { assignmentKeys } from '@/hooks/queries';
import { LangchainEditor } from '@/components/features/langchain/LangchainEditor';
import type { Node, Edge } from '@xyflow/react';

function parsePipelineJson(text: string | null | undefined): { nodes: Node[]; edges: Edge[] } {
  if (!text || !text.trim()) return { nodes: [], edges: [] };
  try {
    const parsed = JSON.parse(text) as { nodes?: unknown; edges?: unknown };
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes)) {
      return {
        nodes: parsed.nodes as Node[],
        edges: Array.isArray(parsed.edges) ? (parsed.edges as Edge[]) : [],
      };
    }
  } catch {
    /* ignore invalid JSON (e.g. legacy essay text) */
  }
  return { nodes: [], edges: [] };
}

interface LangchainBuilderPageProps {
  assignmentId: string;
  submissionId: string;
  /** Saved pipeline JSON from `submissions.text_body` (same shape as Save writes). */
  initialPipelineText?: string | null;
  onComplete: () => void;
}

export function LangchainBuilderPage({
  assignmentId,
  submissionId,
  initialPipelineText,
  onComplete,
}: LangchainBuilderPageProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  /** Bumps after parsing `initialPipelineText` so React Flow remounts with hydrated nodes (useNodesState only reads initial on mount). */
  const [hydrationVersion, setHydrationVersion] = useState(0);

  useLayoutEffect(() => {
    const { nodes: n, edges: e } = parsePipelineJson(initialPipelineText);
    setNodes(n);
    setEdges(e);
    setHydrationVersion((v) => v + 1);
  }, [initialPipelineText]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    setNodes(newNodes);
    setEdges(newEdges);
    setSaved(false);
  }, []);

  const savePipeline = async () => {
    setSaving(true);
    try {
      const pipelineData = JSON.stringify({ nodes, edges });
      const { error } = await supabase
        .from('submissions')
        .update({ text_body: pipelineData })
        .eq('id', submissionId);

      if (error) throw error;
      setSaved(true);
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
    if (nodes.length === 0) {
      toast.error('Please build a pipeline before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const pipelineData = JSON.stringify({ nodes, edges });
      await supabase
        .from('submissions')
        .update({ text_body: pipelineData })
        .eq('id', submissionId);

      const { error } = await completeSubmission(submissionId);
      if (error) throw error;

      toast.success(t('assignmentDetail.langchain.awaitingReview'));
      queryClient.invalidateQueries({ queryKey: assignmentKeys.all });
      onComplete();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

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
              disabled={saving || nodes.length === 0}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t('assignmentDetail.langchain.save')}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || nodes.length === 0}
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
        <div className="h-[600px] border-t">
          <LangchainEditor
            key={hydrationVersion}
            initialNodes={nodes}
            initialEdges={edges}
            onChange={handleChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
