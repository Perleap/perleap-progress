import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeDeleteButton } from '../NodeDeleteButton';
import { ensureLangchainNodeData, truncateLangchainPreview, type LangchainInputNodeData } from '../langchainNodeData';
import {
  LANGCHAIN_NODE_INNER_CLASS,
  LANGCHAIN_NODE_LABEL_CLASS,
  LANGCHAIN_NODE_OUTER_CLASS,
  LANGCHAIN_NODE_PREVIEW_CLASS,
} from './langchainNodeShell';

function InputNodeComponent({ id, selected, ...node }: NodeProps) {
  const { t } = useTranslation();
  const data = ensureLangchainNodeData({ id, selected, ...node }).data as LangchainInputNodeData;
  const preview = truncateLangchainPreview(data.description || data.label, 48);

  return (
    <div className={LANGCHAIN_NODE_OUTER_CLASS}>
      <NodeDeleteButton nodeId={id} selected={selected} />
      <div className={`border-2 border-blue-400 bg-blue-50 dark:bg-blue-950 ${LANGCHAIN_NODE_INNER_CLASS}`}>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
            {t('assignmentDetail.langchain.nodes.input')}
          </span>
        </div>
        <p className={`text-blue-600/90 dark:text-blue-400/90 ${LANGCHAIN_NODE_LABEL_CLASS}`}>{data.label}</p>
        <div className={`text-blue-600 bg-blue-100 dark:bg-blue-900 rounded px-2 py-0.5 ${LANGCHAIN_NODE_PREVIEW_CLASS}`}>
          {preview}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}

export const InputNode = memo(InputNodeComponent);
