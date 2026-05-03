import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Brain } from 'lucide-react';
import { ensureLangchainNodeData, truncateLangchainPreview, type LangchainLlmNodeData } from '../langchainNodeData';

function LLMNodeComponent(node: NodeProps) {
  const data = ensureLangchainNodeData(node as Node).data as LangchainLlmNodeData;
  const subtitle = truncateLangchainPreview(data.systemOrRoleNote || '', 72);

  return (
    <div className="px-4 py-3 rounded-lg border-2 border-purple-400 bg-purple-50 dark:bg-purple-950 shadow-sm min-w-[180px] max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Brain className="h-4 w-4 text-purple-600 shrink-0" />
        <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">LLM</span>
      </div>
      <p className="text-xs text-purple-600/90 dark:text-purple-400/90 font-medium line-clamp-1">{data.label}</p>
      <div className="mt-2 text-[10px] text-purple-500 bg-purple-100 dark:bg-purple-900 rounded px-2 py-0.5 font-mono line-clamp-1">
        {truncateLangchainPreview(data.model || '', 36) || '…'}
      </div>
      {subtitle.trim() !== '' && subtitle !== '…' ? (
        <div className="mt-1 text-[10px] text-purple-600/80 bg-purple-100/70 dark:bg-purple-900 rounded px-2 py-0.5 line-clamp-2 break-words">
          {subtitle}
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" />
    </div>
  );
}

export const LLMNode = memo(LLMNodeComponent);
