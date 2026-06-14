import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeDeleteButton } from '../NodeDeleteButton';
import { ensureLangchainNodeData, truncateLangchainPreview, type LangchainLlmNodeData } from '../langchainNodeData';
import {
  LANGCHAIN_NODE_INNER_CLASS,
  LANGCHAIN_NODE_LABEL_CLASS,
  LANGCHAIN_NODE_OUTER_CLASS,
  LANGCHAIN_NODE_PREVIEW_CLASS,
} from './langchainNodeShell';

function LLMNodeComponent({ id, selected, ...node }: NodeProps) {
  const { t } = useTranslation();
  const data = ensureLangchainNodeData({ id, selected, ...node }).data as LangchainLlmNodeData;
  const preview = truncateLangchainPreview(data.systemPrompt || '', 48);

  return (
    <div className={LANGCHAIN_NODE_OUTER_CLASS}>
      <NodeDeleteButton nodeId={id} selected={selected} />
      <div className={`border-2 border-purple-400 bg-purple-50 dark:bg-purple-950 ${LANGCHAIN_NODE_INNER_CLASS}`}>
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4 text-purple-600 shrink-0" />
          <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
            {t('assignmentDetail.langchain.nodes.llm')}
          </span>
        </div>
        <p className={`text-purple-600/90 dark:text-purple-400/90 ${LANGCHAIN_NODE_LABEL_CLASS}`}>{data.label}</p>
        <div className={`text-purple-600/80 bg-purple-100/70 dark:bg-purple-900 rounded px-2 py-0.5 ${LANGCHAIN_NODE_PREVIEW_CLASS}`}>
          {preview}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" />
    </div>
  );
}

export const LLMNode = memo(LLMNodeComponent);
