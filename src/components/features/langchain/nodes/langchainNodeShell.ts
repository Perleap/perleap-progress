/** Fixed canvas node dimensions — keep in sync across all Langchain node components. */
export const LANGCHAIN_NODE_WIDTH_CLASS = 'w-[200px]';
export const LANGCHAIN_NODE_HEIGHT_CLASS = 'h-[96px]';
/** Outer wrapper: fixed size, allows delete button to sit outside without clipping. */
export const LANGCHAIN_NODE_OUTER_CLASS = `${LANGCHAIN_NODE_WIDTH_CLASS} ${LANGCHAIN_NODE_HEIGHT_CLASS} shrink-0 relative`;
/** Inner card: clips overflowing preview text. */
export const LANGCHAIN_NODE_INNER_CLASS = 'h-full overflow-hidden rounded-lg shadow-sm px-3 py-2.5';
export const LANGCHAIN_NODE_LABEL_CLASS = 'text-xs font-medium truncate';
export const LANGCHAIN_NODE_PREVIEW_CLASS =
  'mt-1.5 h-8 overflow-hidden text-[10px] leading-4 line-clamp-2 break-all';
