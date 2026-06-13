import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, FileOutput, Brain, Zap, Mail } from 'lucide-react';

const NODE_TYPES_CONFIG = [
  { type: 'inputNode', icon: MessageSquare, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { type: 'outputNode', icon: FileOutput, color: 'text-green-600 bg-green-50 border-green-200' },
  { type: 'llmNode', icon: Brain, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { type: 'triggerNode', icon: Zap, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { type: 'emailNode', icon: Mail, color: 'text-teal-600 bg-teal-50 border-teal-200' },
] as const;

const NODE_KEY_MAP: Record<string, string> = {
  inputNode: 'input',
  outputNode: 'output',
  llmNode: 'llm',
  triggerNode: 'trigger',
  emailNode: 'email',
};

export function NodePalette() {
  const { t } = useTranslation();
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  const onDragEnd = useCallback(() => {
    dragImageRef.current?.remove();
    dragImageRef.current = null;
  }, []);

  const onDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
    event.stopPropagation();
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';

    const source = event.currentTarget;
    const rect = source.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const clone = source.cloneNode(true) as HTMLDivElement;
    clone.style.position = 'fixed';
    clone.style.top = '-2000px';
    clone.style.left = '-2000px';
    clone.style.width = `${source.offsetWidth}px`;
    clone.style.margin = '0';
    clone.style.pointerEvents = 'none';
    clone.style.opacity = '0.92';
    clone.style.boxShadow = '0 4px 12px rgb(0 0 0 / 0.15)';
    document.body.appendChild(clone);
    dragImageRef.current = clone;

    event.dataTransfer.setDragImage(clone, offsetX, offsetY);
  }, []);

  return (
    <div className="space-y-2 select-none">
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
            onDragEnd={onDragEnd}
            className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-shadow hover:shadow-sm ${color}`}
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
