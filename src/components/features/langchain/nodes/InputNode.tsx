import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';

function InputNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-blue-400 bg-blue-50 dark:bg-blue-950 shadow-sm min-w-[160px]">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="h-4 w-4 text-blue-600" />
        <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Input</span>
      </div>
      <p className="text-xs text-blue-600/80 dark:text-blue-400/80">{(data as any).label || 'User input entry point'}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}

export const InputNode = memo(InputNodeComponent);
