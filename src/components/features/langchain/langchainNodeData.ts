import type { Edge, Node } from '@xyflow/react';

/** Stored with pipeline JSON in `submissions.text_body`. */
export const LANGCHAIN_PIPELINE_SCHEMA_VERSION = 1 as const;

export type LangchainPipelineEnvelope = {
  schemaVersion: typeof LANGCHAIN_PIPELINE_SCHEMA_VERSION;
  nodes: Node[];
  edges: Edge[];
};

export type LangchainNodeType =
  | 'inputNode'
  | 'outputNode'
  | 'llmNode'
  | 'promptNode'
  | 'chainNode'
  | 'memoryNode';

export type MemoryStrategy = 'buffer' | 'summary' | 'other';

export type LangchainInputNodeData = {
  label: string;
  description: string;
};

export type LangchainOutputNodeData = {
  label: string;
  description: string;
};

export type LangchainLlmNodeData = {
  label: string;
  model: string;
  systemOrRoleNote: string;
  /** Optional; empty string = unset */
  temperature: string;
};

export type LangchainPromptNodeData = {
  label: string;
  template: string;
  variablesHint: string;
};

export type LangchainChainNodeData = {
  label: string;
  description: string;
  orderingNote: string;
};

export type LangchainMemoryNodeData = {
  label: string;
  strategy: MemoryStrategy;
  description: string;
};

export type LangchainNodeDataByType = {
  inputNode: LangchainInputNodeData;
  outputNode: LangchainOutputNodeData;
  llmNode: LangchainLlmNodeData;
  promptNode: LangchainPromptNodeData;
  chainNode: LangchainChainNodeData;
  memoryNode: LangchainMemoryNodeData;
};

const DEFAULT_LABELS: Record<LangchainNodeType, string> = {
  inputNode: 'User Input',
  outputNode: 'Output',
  llmNode: 'LLM',
  promptNode: 'Prompt Template',
  chainNode: 'Chain',
  memoryNode: 'Memory',
};

export function isLangchainNodeType(t: string | undefined): t is LangchainNodeType {
  return (
    t === 'inputNode' ||
    t === 'outputNode' ||
    t === 'llmNode' ||
    t === 'promptNode' ||
    t === 'chainNode' ||
    t === 'memoryNode'
  );
}

export function defaultDataForLangchainNodeType(type: LangchainNodeType): LangchainNodeDataByType[LangchainNodeType] {
  const label = DEFAULT_LABELS[type];
  switch (type) {
    case 'inputNode':
      return { label, description: '' };
    case 'outputNode':
      return { label, description: '' };
    case 'llmNode':
      return { label, model: 'gpt-4', systemOrRoleNote: '', temperature: '' };
    case 'promptNode':
      return { label, template: '', variablesHint: '' };
    case 'chainNode':
      return { label, description: '', orderingNote: '' };
    case 'memoryNode':
      return { label, strategy: 'buffer', description: '' };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Merge saved node `data` with defaults so inspector always has full shape. */
export function ensureLangchainNodeData(node: Node): Node {
  const t = node.type;
  if (!isLangchainNodeType(t)) return node;
  const base = defaultDataForLangchainNodeType(t);
  const raw = (node.data || {}) as Record<string, unknown>;
  const merged = { ...base, ...raw } as LangchainNodeDataByType[typeof t];
  if (t === 'memoryNode') {
    const s = raw.strategy;
    if (s === 'buffer' || s === 'summary' || s === 'other') {
      (merged as LangchainMemoryNodeData).strategy = s;
    }
  }
  return { ...node, data: merged };
}

/**
 * Ensures React Flow always gets a registered `node.type`.
 * Stored JSON may use missing/foreign types (e.g. legacy React Flow `"default"`); those would
 * otherwise skip `ensureLangchainNodeData` and crash with "Component is not a function".
 */
export function normalizeLangchainNodeForFlow(node: Node): Node {
  const merged = ensureLangchainNodeData(node);
  if (isLangchainNodeType(merged.type)) {
    return merged;
  }
  const stray = merged.type ?? 'unset';
  const raw =
    merged.data !== null && typeof merged.data === 'object'
      ? (merged.data as Record<string, unknown>)
      : {};

  const baseLabel =
    typeof raw.label === 'string' && raw.label.trim() ? String(raw.label) : DEFAULT_LABELS.chainNode;

  return ensureLangchainNodeData({
    ...merged,
    type: 'chainNode',
    data: {
      ...raw,
      label: `${baseLabel} (${String(stray)})`,
      description: typeof raw.description === 'string' ? raw.description : '',
      orderingNote: typeof raw.orderingNote === 'string' ? raw.orderingNote : '',
    },
  });
}

export function parsePipelineJson(text: string | null | undefined): { nodes: Node[]; edges: Edge[] } {
  if (!text || !text.trim()) return { nodes: [], edges: [] };
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return { nodes: [], edges: [] };
    const obj = parsed as Record<string, unknown>;

    let nodesRaw: unknown;
    let edgesRaw: unknown;
    if (
      obj.schemaVersion === LANGCHAIN_PIPELINE_SCHEMA_VERSION &&
      Array.isArray(obj.nodes) &&
      (obj.edges === undefined || Array.isArray(obj.edges))
    ) {
      nodesRaw = obj.nodes;
      edgesRaw = obj.edges;
    } else if (Array.isArray(obj.nodes)) {
      nodesRaw = obj.nodes;
      edgesRaw = obj.edges;
    } else {
      return { nodes: [], edges: [] };
    }

    const nodes = (nodesRaw as Node[]).map(normalizeLangchainNodeForFlow);
    const edges = Array.isArray(edgesRaw) ? (edgesRaw as Edge[]) : [];
    return { nodes, edges };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export function serializePipeline(nodes: Node[], edges: Edge[]): string {
  const envelope: LangchainPipelineEnvelope = {
    schemaVersion: LANGCHAIN_PIPELINE_SCHEMA_VERSION,
    nodes,
    edges,
  };
  return JSON.stringify(envelope);
}

/** When true, submit/save requires non-empty template on prompt nodes and model on LLM nodes. */
export const LANGCHAIN_STRICT_FIELD_VALIDATION = false;

export function hasPathFromInputToOutput(nodes: Node[], edges: Edge[]): boolean {
  const inputIds = new Set(
    nodes.filter((n) => n.type === 'inputNode').map((n) => n.id)
  );
  const outputIds = new Set(
    nodes.filter((n) => n.type === 'outputNode').map((n) => n.id)
  );
  if (inputIds.size === 0 || outputIds.size === 0) return false;

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!e.source || !e.target) continue;
    const list = adj.get(e.source);
    if (list) list.push(e.target);
    else adj.set(e.source, [e.target]);
  }

  for (const start of inputIds) {
    const seen = new Set<string>([start]);
    const q = [start];
    while (q.length) {
      const u = q.pop()!;
      if (outputIds.has(u)) return true;
      for (const v of adj.get(u) ?? []) {
        if (!seen.has(v)) {
          seen.add(v);
          q.push(v);
        }
      }
    }
  }
  return false;
}

export type LangchainPipelineValidationIssue =
  | 'emptyGraph'
  | 'noInputToOutputPath'
  | 'promptTemplateRequired'
  | 'llmModelRequired';

export function validateLangchainPipeline(
  nodes: Node[],
  edges: Edge[],
  options: { strictFields?: boolean } = {}
): { ok: boolean; issues: LangchainPipelineValidationIssue[] } {
  const strict = options.strictFields ?? LANGCHAIN_STRICT_FIELD_VALIDATION;
  const issues: LangchainPipelineValidationIssue[] = [];

  if (nodes.length === 0) {
    issues.push('emptyGraph');
    return { ok: false, issues };
  }

  if (!hasPathFromInputToOutput(nodes, edges)) {
    issues.push('noInputToOutputPath');
  }

  if (strict) {
    for (const n of nodes) {
      if (n.type === 'promptNode') {
        const d = n.data as LangchainPromptNodeData;
        if (!String(d?.template ?? '').trim()) issues.push('promptTemplateRequired');
      }
      if (n.type === 'llmNode') {
        const d = n.data as LangchainLlmNodeData;
        if (!String(d?.model ?? '').trim()) issues.push('llmModelRequired');
      }
    }
  }

  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

/** Single-line preview under the node title on the canvas (not i18n — student content). */
export function truncateLangchainPreview(text: string, maxLen = 44): string {
  const one = text.replace(/\s+/g, ' ').trim();
  if (one.length <= maxLen) return one || '…';
  return `${one.slice(0, Math.max(1, maxLen - 1))}…`;
}
