import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';

function PromptNodeComponent({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950 shadow-sm min-w-[180px]">
      <Handle type="target" position={Position.Top} className="!bg-amber-500 !w-3 !h-3" />
      <div className="flex items-center gap-2 mb-1">
        <FileText className="h-4 w-4 text-amber-600" />
        <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Prompt</span>
      </div>
      <p className="text-xs text-amber-600/80 dark:text-amber-400/80">{(data as any).label || 'Prompt Template'}</p>
      <div className="mt-2 text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-900 rounded px-2 py-0.5 max-w-[200px] truncate">
        {(data as any).template || 'Template text...'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500 !w-3 !h-3" />
    </div>
  );
}

export const PromptNode = memo(PromptNodeComponent);
