import { X } from 'lucide-react';
import { useLangchainEditorContext } from './LangchainEditorContext';

export function NodeDeleteButton({
  nodeId,
  selected,
}: {
  nodeId: string;
  selected?: boolean;
}) {
  const { readOnly, onDeleteNode } = useLangchainEditorContext();

  if (!selected || readOnly) return null;

  return (
    <button
      type="button"
      aria-label="Delete node"
      className="nodrag nopan absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md ring-2 ring-background hover:bg-red-600 transition-colors"
      onClick={(event) => {
        event.stopPropagation();
        onDeleteNode(nodeId);
      }}
    >
      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
    </button>
  );
}
