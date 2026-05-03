import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';
import { ensureLangchainNodeData, truncateLangchainPreview, type LangchainMemoryNodeData } from '../langchainNodeData';

function MemoryNodeComponent(node: NodeProps) {
  const { t } = useTranslation();
  const data = ensureLangchainNodeData(node as Node).data as LangchainMemoryNodeData;
  const strategy = data.strategy;

  const desc = truncateLangchainPreview(data.description || data.label);

  return (
    <div className="px-4 py-3 rounded-lg border-2 border-cyan-400 bg-cyan-50 dark:bg-cyan-950 shadow-sm min-w-[160px] max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Database className="h-4 w-4 text-cyan-600 shrink-0" />
        <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-wide">Memory</span>
      </div>
      <p className="text-xs text-cyan-600/90 dark:text-cyan-400/90 font-medium line-clamp-1">{data.label}</p>
      <div className="mt-2 text-[10px] text-cyan-600 bg-cyan-100 dark:bg-cyan-900 rounded px-2 py-0.5 line-clamp-1">
        {t(`assignmentDetail.langchain.inspector.strategy.${strategy}`)}
      </div>
      <div className="mt-1 text-[10px] text-cyan-600/85 bg-cyan-100/70 dark:bg-cyan-900 rounded px-2 py-0.5 line-clamp-2 break-words">
        {desc}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-500 !w-3 !h-3" />
    </div>
  );
}

export const MemoryNode = memo(MemoryNodeComponent);
