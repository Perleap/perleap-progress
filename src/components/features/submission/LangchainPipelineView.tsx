import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Workflow } from 'lucide-react';
import { LangchainEditor } from '@/components/features/langchain/LangchainEditor';
import { parsePipelineJson } from '@/components/features/langchain/langchainNodeData';
import { TeacherEvaluationForm } from './TeacherEvaluationForm';

interface LangchainPipelineViewProps {
  textBody: string | null | undefined;
  submissionId: string;
  studentId: string;
  assignmentId: string;
  hasFeedback: boolean;
  onEvaluationComplete: () => void;
}

export function LangchainPipelineView({
  textBody,
  submissionId,
  studentId,
  assignmentId,
  hasFeedback,
  onEvaluationComplete,
}: LangchainPipelineViewProps) {
  const { t } = useTranslation();

  const { nodes, edges } = useMemo(() => parsePipelineJson(textBody), [textBody]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">{t('submissionDetail.langchainView.title')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {nodes.length > 0 ? (
            <div className="h-[560px] min-h-[440px] border-t">
              <LangchainEditor
                initialNodes={nodes}
                initialEdges={edges}
                readOnly
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Workflow className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">{t('submissionDetail.langchainView.noPipeline')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {!hasFeedback && (
        <TeacherEvaluationForm
          submissionId={submissionId}
          studentId={studentId}
          assignmentId={assignmentId}
          onEvaluationComplete={onEvaluationComplete}
        />
      )}
    </div>
  );
}
