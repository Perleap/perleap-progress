import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { ensureLangchainNodeData, truncateLangchainPreview, type LangchainInputNodeData } from '../langchainNodeData';

function InputNodeComponent(node: NodeProps) {
  const data = ensureLangchainNodeData(node as Node).data as LangchainInputNodeData;
  const preview = truncateLangchainPreview(data.description || data.label);

  return (
    <div className="px-4 py-3 rounded-lg border-2 border-blue-400 bg-blue-50 dark:bg-blue-950 shadow-sm min-w-[160px] max-w-[220px]">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
          Input
        </span>
      </div>
      <p className="text-xs text-blue-600/90 dark:text-blue-400/90 font-medium line-clamp-1">{data.label}</p>
      <div className="mt-2 text-[10px] text-blue-600 bg-blue-100 dark:bg-blue-900 rounded px-2 py-0.5 line-clamp-2 break-words">
        {preview}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}

export const InputNode = memo(InputNodeComponent);
