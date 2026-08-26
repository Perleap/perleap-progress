import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeDeleteButton } from '../NodeDeleteButton';
import {
  ensureLangchainNodeData,
  truncateLangchainPreview,
  type LangchainEmailNodeData,
} from '../langchainNodeData';
import {
  LANGCHAIN_NODE_INNER_CLASS,
  LANGCHAIN_NODE_LABEL_CLASS,
  LANGCHAIN_NODE_OUTER_CLASS,
  LANGCHAIN_NODE_PREVIEW_CLASS,
} from './langchainNodeShell';

function EmailNodeComponent({ id, selected, ...node }: NodeProps) {
  const { t } = useTranslation();
  const data = ensureLangchainNodeData({ id, selected, ...node }).data as LangchainEmailNodeData;
  const preview = truncateLangchainPreview(data.sendTo || '', 48);

  return (
    <div className={LANGCHAIN_NODE_OUTER_CLASS}>
      <NodeDeleteButton nodeId={id} selected={selected} />
      <div className={`border-2 border-teal-400 bg-teal-50 dark:bg-teal-950 ${LANGCHAIN_NODE_INNER_CLASS}`}>
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-teal-600 shrink-0" />
          <span className="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wide">
            {t('assignmentDetail.langchain.nodes.email')}
          </span>
        </div>
        <p className={`text-teal-600/90 dark:text-teal-400/90 ${LANGCHAIN_NODE_LABEL_CLASS}`}>{data.label}</p>
        <div className={`text-teal-600 bg-teal-100 dark:bg-teal-900 rounded px-2 py-0.5 ${LANGCHAIN_NODE_PREVIEW_CLASS}`}>
          {preview}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-3 !h-3" />
    </div>
  );
}

export const EmailNode = memo(EmailNodeComponent);
