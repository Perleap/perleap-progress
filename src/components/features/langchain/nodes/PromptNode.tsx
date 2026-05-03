import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { FileText } from 'lucide-react';
import { ensureLangchainNodeData, truncateLangchainPreview, type LangchainPromptNodeData } from '../langchainNodeData';

function PromptNodeComponent(node: NodeProps) {
  const data = ensureLangchainNodeData(node as Node).data as LangchainPromptNodeData;
  const templatePreview = truncateLangchainPreview(data.template || '', 56);

  return (
    <div className="px-4 py-3 rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950 shadow-sm min-w-[180px] max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Prompt</span>
      </div>
      <p className="text-xs text-amber-600/90 dark:text-amber-400/90 font-medium line-clamp-1">{data.label}</p>
      <div className="mt-2 text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-900 rounded px-2 py-0.5 line-clamp-2 break-words min-h-[1.25rem]">
        {templatePreview || '…'}
      </div>
      {data.variablesHint.trim() !== '' ? (
        <div className="mt-1 text-[10px] text-amber-500/90 line-clamp-1 truncate">
          {truncateLangchainPreview(data.variablesHint, 40)}
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3" />
    </div>
  );
}

export const PromptNode = memo(PromptNodeComponent);
