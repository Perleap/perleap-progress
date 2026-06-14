import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NodeDeleteButton } from '../NodeDeleteButton';
import {
  ensureLangchainNodeData,
  truncateLangchainPreview,
  type LangchainDatabaseNodeData,
} from '../langchainNodeData';
import {
  LANGCHAIN_NODE_INNER_CLASS,
  LANGCHAIN_NODE_LABEL_CLASS,
  LANGCHAIN_NODE_OUTER_CLASS,
  LANGCHAIN_NODE_PREVIEW_CLASS,
} from './langchainNodeShell';

function DatabaseNodeComponent({ id, selected, ...node }: NodeProps) {
  const { t } = useTranslation();
  const data = ensureLangchainNodeData({ id, selected, ...node }).data as LangchainDatabaseNodeData;
  const preview = truncateLangchainPreview(data.description || data.label, 48);

  return (
    <div className={LANGCHAIN_NODE_OUTER_CLASS}>
      <NodeDeleteButton nodeId={id} selected={selected} />
      <div className={`border-2 border-indigo-400 bg-indigo-50 dark:bg-indigo-950 ${LANGCHAIN_NODE_INNER_CLASS}`}>
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-4 w-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
            {t('assignmentDetail.langchain.nodes.database')}
          </span>
        </div>
        <p className={`text-indigo-600/90 dark:text-indigo-400/90 ${LANGCHAIN_NODE_LABEL_CLASS}`}>{data.label}</p>
        <div className={`text-indigo-600 bg-indigo-100 dark:bg-indigo-900 rounded px-2 py-0.5 ${LANGCHAIN_NODE_PREVIEW_CLASS}`}>
          {preview}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !w-3 !h-3" />
      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !w-3 !h-3" />
    </div>
  );
}

export const DatabaseNode = memo(DatabaseNodeComponent);
