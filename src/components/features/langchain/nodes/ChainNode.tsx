import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Link2 } from 'lucide-react';
import { ensureLangchainNodeData, truncateLangchainPreview, type LangchainChainNodeData } from '../langchainNodeData';

function ChainNodeComponent(node: NodeProps) {
  const data = ensureLangchainNodeData(node as Node).data as LangchainChainNodeData;
  const desc = truncateLangchainPreview(data.description || data.label);

  return (
    <div className="px-4 py-3 rounded-lg border-2 border-rose-400 bg-rose-50 dark:bg-rose-950 shadow-sm min-w-[180px] max-w-[240px]">
      <Handle type="target" position={Position.Top} className="!bg-rose-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="h-4 w-4 text-rose-600 shrink-0" />
        <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wide">Chain</span>
      </div>
      <p className="text-xs text-rose-600/90 dark:text-rose-400/90 font-medium line-clamp-1">{data.label}</p>
      <div className="mt-2 text-[10px] text-rose-600 bg-rose-100 dark:bg-rose-900 rounded px-2 py-0.5 line-clamp-2 break-words">
        {desc}
      </div>
      {data.orderingNote.trim() !== '' ? (
        <div className="mt-1 text-[10px] text-rose-500/80 line-clamp-1">
          {truncateLangchainPreview(data.orderingNote, 44)}
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} className="!bg-rose-500 !w-3 !h-3" />
    </div>
  );
}

export const ChainNode = memo(ChainNodeComponent);
