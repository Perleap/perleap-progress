import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileOutput } from 'lucide-react';

function OutputNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-green-400 bg-green-50 dark:bg-green-950 shadow-sm min-w-[160px]">
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <FileOutput className="h-4 w-4 text-green-600" />
        <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">Output</span>
      </div>
      <p className="text-xs text-green-600/80 dark:text-green-400/80">{(data as any).label || 'Final output node'}</p>
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
