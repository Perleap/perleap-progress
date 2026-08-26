import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeDeleteButton } from '../NodeDeleteButton';
import {
  ensureLangchainNodeData,
  type LangchainTriggerNodeData,
} from '../langchainNodeData';
import {
  LANGCHAIN_NODE_INNER_CLASS,
  LANGCHAIN_NODE_LABEL_CLASS,
  LANGCHAIN_NODE_OUTER_CLASS,
  LANGCHAIN_NODE_PREVIEW_CLASS,
} from './langchainNodeShell';

function TriggerNodeComponent({ id, selected, ...node }: NodeProps) {
  const { t } = useTranslation();
  const data = ensureLangchainNodeData({ id, selected, ...node }).data as LangchainTriggerNodeData;
  const modeLabel = t(`assignmentDetail.langchain.inspector.triggerMode.${data.mode}`);

  return (
    <div className={LANGCHAIN_NODE_OUTER_CLASS}>
      <NodeDeleteButton nodeId={id} selected={selected} />
      <div className={`border-2 border-orange-400 bg-orange-50 dark:bg-orange-950 ${LANGCHAIN_NODE_INNER_CLASS}`}>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-orange-600 shrink-0" />
          <span className="text-xs font-bold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
            {t('assignmentDetail.langchain.nodes.trigger')}
          </span>
        </div>
        <p className={`text-orange-600/90 dark:text-orange-400/90 ${LANGCHAIN_NODE_LABEL_CLASS}`}>{data.label}</p>
        <div className={`text-orange-600 bg-orange-100 dark:bg-orange-900 rounded px-2 py-0.5 ${LANGCHAIN_NODE_PREVIEW_CLASS}`}>
          {modeLabel}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-3 !h-3" />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
