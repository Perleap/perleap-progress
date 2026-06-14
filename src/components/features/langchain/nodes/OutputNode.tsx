import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { FileOutput } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeDeleteButton } from '../NodeDeleteButton';
import { ensureLangchainNodeData, truncateLangchainPreview, type LangchainOutputNodeData } from '../langchainNodeData';
import {
  LANGCHAIN_NODE_INNER_CLASS,
  LANGCHAIN_NODE_LABEL_CLASS,
  LANGCHAIN_NODE_OUTER_CLASS,
  LANGCHAIN_NODE_PREVIEW_CLASS,
} from './langchainNodeShell';

function OutputNodeComponent({ id, selected, ...node }: NodeProps) {
  const { t } = useTranslation();
  const data = ensureLangchainNodeData({ id, selected, ...node }).data as LangchainOutputNodeData;
  const preview = truncateLangchainPreview(data.description || data.label, 48);

  return (
    <div className={LANGCHAIN_NODE_OUTER_CLASS}>
      <NodeDeleteButton nodeId={id} selected={selected} />
      <div className={`border-2 border-green-400 bg-green-50 dark:bg-green-950 ${LANGCHAIN_NODE_INNER_CLASS}`}>
        <div className="flex items-center gap-2 mb-1">
          <FileOutput className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">
            {t('assignmentDetail.langchain.nodes.output')}
          </span>
        </div>
        <p className={`text-green-600/90 dark:text-green-400/90 ${LANGCHAIN_NODE_LABEL_CLASS}`}>{data.label}</p>
        <div className={`text-green-600 bg-green-100 dark:bg-green-900 rounded px-2 py-0.5 ${LANGCHAIN_NODE_PREVIEW_CLASS}`}>
          {preview}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
