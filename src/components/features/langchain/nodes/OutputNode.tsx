import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { FileOutput } from 'lucide-react';
import { ensureLangchainNodeData, truncateLangchainPreview, type LangchainOutputNodeData } from '../langchainNodeData';

function OutputNodeComponent(node: NodeProps) {
  const data = ensureLangchainNodeData(node as Node).data as LangchainOutputNodeData;
  const preview = truncateLangchainPreview(data.description || data.label);

  return (
    <div className="px-4 py-3 rounded-lg border-2 border-green-400 bg-green-50 dark:bg-green-950 shadow-sm min-w-[160px] max-w-[220px]">
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <FileOutput className="h-4 w-4 text-green-600 shrink-0" />
        <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">
          Output
        </span>
      </div>
      <p className="text-xs text-green-600/90 dark:text-green-400/90 font-medium line-clamp-1">{data.label}</p>
      <div className="mt-2 text-[10px] text-green-600 bg-green-100 dark:bg-green-900 rounded px-2 py-0.5 line-clamp-2 break-words">
        {preview}
      </div>
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
