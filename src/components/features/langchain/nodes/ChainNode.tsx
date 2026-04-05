import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Link2 } from 'lucide-react';

function ChainNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-rose-400 bg-rose-50 dark:bg-rose-950 shadow-sm min-w-[180px]">
      <Handle type="target" position={Position.Top} className="!bg-rose-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="h-4 w-4 text-rose-600" />
        <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wide">Chain</span>
      </div>
      <p className="text-xs text-rose-600/80 dark:text-rose-400/80">{(data as any).label || 'Sequential chain'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-rose-500 !w-3 !h-3" />
    </div>
  );
}

export const ChainNode = memo(ChainNodeComponent);
