import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Brain } from 'lucide-react';

function LLMNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-purple-400 bg-purple-50 dark:bg-purple-950 shadow-sm min-w-[180px]">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <Brain className="h-4 w-4 text-purple-600" />
        <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">LLM</span>
      </div>
      <p className="text-xs text-purple-600/80 dark:text-purple-400/80">{(data as any).label || 'Large Language Model'}</p>
      <div className="mt-2 text-[10px] text-purple-500 bg-purple-100 dark:bg-purple-900 rounded px-2 py-0.5">
        {(data as any).model || 'gpt-4'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" />
    </div>
  );
}

export const LLMNode = memo(LLMNodeComponent);
