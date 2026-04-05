import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Database } from 'lucide-react';

function MemoryNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-cyan-400 bg-cyan-50 dark:bg-cyan-950 shadow-sm min-w-[160px]">
      <Handle type="target" position={Position.Top} className="!bg-cyan-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Database className="h-4 w-4 text-cyan-600" />
        <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-wide">Memory</span>
      </div>
      <p className="text-xs text-cyan-600/80 dark:text-cyan-400/80">{(data as any).label || 'Conversation memory'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-500 !w-3 !h-3" />
    </div>
  );
}

export const MemoryNode = memo(MemoryNodeComponent);
