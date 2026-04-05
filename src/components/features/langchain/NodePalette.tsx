import { useTranslation } from 'react-i18next';
import { MessageSquare, FileOutput, Brain, FileText, Link2, Database } from 'lucide-react';

const NODE_TYPES_CONFIG = [
  { type: 'inputNode', icon: MessageSquare, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { type: 'outputNode', icon: FileOutput, color: 'text-green-600 bg-green-50 border-green-200' },
  { type: 'llmNode', icon: Brain, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { type: 'promptNode', icon: FileText, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { type: 'chainNode', icon: Link2, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { type: 'memoryNode', icon: Database, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
] as const;

const NODE_KEY_MAP: Record<string, string> = {
  inputNode: 'input',
  outputNode: 'output',
  llmNode: 'llm',
  promptNode: 'prompt',
  chainNode: 'chain',
  memoryNode: 'memory',
};

export function NodePalette() {
  const { t } = useTranslation();

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {t('assignmentDetail.langchain.addNode')}
      </h3>
      {NODE_TYPES_CONFIG.map(({ type, icon: Icon, color }) => {
        const key = NODE_KEY_MAP[type];
        return (
          <div
            key={type}
            draggable
            onDragStart={(e) => onDragStart(e, type)}
            className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all hover:shadow-sm ${color}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">
                {t(`assignmentDetail.langchain.nodes.${key}`)}
              </p>
              <p className="text-[10px] opacity-70 leading-tight truncate">
                {t(`assignmentDetail.langchain.nodeDescriptions.${key}`)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
