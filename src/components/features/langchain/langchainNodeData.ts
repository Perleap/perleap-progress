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
  | 'triggerNode'
  | 'emailNode';

export type TriggerMode = 'incoming_mail' | 'manual' | 'webhook' | 'form_submit';

export const TRIGGER_MODES: TriggerMode[] = ['incoming_mail', 'manual', 'webhook', 'form_submit'];

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
  systemPrompt: string;
};

export type LangchainTriggerNodeData = {
  label: string;
  mode: TriggerMode;
};

export type LangchainEmailNodeData = {
  label: string;
  sendTo: string;
};

export type LangchainNodeDataByType = {
  inputNode: LangchainInputNodeData;
  outputNode: LangchainOutputNodeData;
  llmNode: LangchainLlmNodeData;
  triggerNode: LangchainTriggerNodeData;
  emailNode: LangchainEmailNodeData;
};

const DEFAULT_LABELS: Record<LangchainNodeType, string> = {
  inputNode: 'User Input',
  outputNode: 'Output',
  llmNode: 'LLM',
  triggerNode: 'Trigger',
  emailNode: 'Email',
};

/** Removed node types kept for legacy pipeline normalization. */
const LEGACY_NODE_TYPES = new Set(['promptNode', 'chainNode', 'memoryNode']);

const LEGACY_TYPE_PREFIX: Record<string, string> = {
  promptNode: 'Legacy Prompt',
  chainNode: 'Legacy Chain',
  memoryNode: 'Legacy Memory',
};

function isTriggerMode(v: unknown): v is TriggerMode {
  return v === 'incoming_mail' || v === 'manual' || v === 'webhook' || v === 'form_submit';
}

function legacyTextFromRaw(type: string, raw: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof raw.template === 'string' && raw.template.trim()) parts.push(raw.template);
  if (typeof raw.variablesHint === 'string' && raw.variablesHint.trim()) {
    parts.push(`Variables: ${raw.variablesHint}`);
  }
  if (typeof raw.description === 'string' && raw.description.trim()) parts.push(raw.description);
  if (typeof raw.orderingNote === 'string' && raw.orderingNote.trim()) {
    parts.push(`Order: ${raw.orderingNote}`);
  }
  if (typeof raw.strategy === 'string' && raw.strategy.trim()) {
    parts.push(`Strategy: ${raw.strategy}`);
  }
  if (typeof raw.systemOrRoleNote === 'string' && raw.systemOrRoleNote.trim()) {
    parts.push(raw.systemOrRoleNote);
  }
  if (typeof raw.systemPrompt === 'string' && raw.systemPrompt.trim()) parts.push(raw.systemPrompt);
  if (parts.length > 0) return parts.join('\n\n');
  return `[${type}]`;
}

export function isLangchainNodeType(t: string | undefined): t is LangchainNodeType {
  return (
    t === 'inputNode' ||
    t === 'outputNode' ||
    t === 'llmNode' ||
    t === 'triggerNode' ||
    t === 'emailNode'
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
      return { label, systemPrompt: '' };
    case 'triggerNode':
      return { label, mode: 'incoming_mail' };
    case 'emailNode':
      return { label, sendTo: '' };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/** Minimal node shape accepted by ensureLangchainNodeData (NodeProps or full Node). */
type LangchainNodeLike = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
};

/** Merge saved node `data` with defaults so inspector always has full shape. */
export function ensureLangchainNodeData<T extends LangchainNodeLike>(node: T): T {
  const t = node.type;
  if (!isLangchainNodeType(t)) return node;
  const base = defaultDataForLangchainNodeType(t);
  const raw = (node.data || {}) as Record<string, unknown>;
  const merged = { ...base, ...raw } as LangchainNodeDataByType[typeof t];

  if (t === 'llmNode') {
    const llm = merged as LangchainLlmNodeData;
    if (!String(llm.systemPrompt ?? '').trim() && typeof raw.systemOrRoleNote === 'string') {
      llm.systemPrompt = raw.systemOrRoleNote;
    }
  }

  if (t === 'triggerNode') {
    const trigger = merged as LangchainTriggerNodeData;
    if (!isTriggerMode(trigger.mode)) {
      trigger.mode = 'incoming_mail';
    }
  }

  return { ...node, data: merged };
}

function normalizeLegacyNodeForFlow(node: Node, type: string): Node {
  const raw =
    node.data !== null && typeof node.data === 'object'
      ? (node.data as Record<string, unknown>)
      : {};

  const baseLabel =
    typeof raw.label === 'string' && raw.label.trim() ? String(raw.label) : type;
  const prefix = LEGACY_TYPE_PREFIX[type] ?? 'Legacy';
  const systemPrompt = legacyTextFromRaw(type, raw);

  return ensureLangchainNodeData({
    ...node,
    type: 'llmNode',
    data: {
      label: `[${prefix}] ${baseLabel}`,
      systemPrompt,
    },
  });
}

/**
 * Ensures React Flow always gets a registered `node.type`.
 * Stored JSON may use missing/foreign types (e.g. legacy React Flow `"default"`); those would
 * otherwise skip `ensureLangchainNodeData` and crash with "Component is not a function".
 */
export function normalizeLangchainNodeForFlow(node: Node): Node {
  const type = node.type ?? 'unset';

  if (LEGACY_NODE_TYPES.has(type)) {
    return normalizeLegacyNodeForFlow(node, type);
  }

  const merged = ensureLangchainNodeData(node);
  if (isLangchainNodeType(merged.type)) {
    return merged;
  }

  return normalizeLegacyNodeForFlow(merged, String(type));
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
    const edges = Array.isArray(edgesRaw)
      ? (edgesRaw as Edge[]).map((e) => ({ ...e, type: e.type ?? 'deletable' }))
      : [];
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

export function hasPathFromStartToOutput(nodes: Node[], edges: Edge[]): boolean {
  const startIds = new Set(
    nodes
      .filter((n) => n.type === 'inputNode' || n.type === 'triggerNode')
      .map((n) => n.id)
  );
  const outputIds = new Set(
    nodes.filter((n) => n.type === 'outputNode').map((n) => n.id)
  );
  if (startIds.size === 0 || outputIds.size === 0) return false;

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!e.source || !e.target) continue;
    const list = adj.get(e.source);
    if (list) list.push(e.target);
    else adj.set(e.source, [e.target]);
  }

  for (const start of startIds) {
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

/** @deprecated Use hasPathFromStartToOutput */
export function hasPathFromInputToOutput(nodes: Node[], edges: Edge[]): boolean {
  return hasPathFromStartToOutput(nodes, edges);
}

export type LangchainPipelineValidationIssue =
  | 'emptyGraph'
  | 'noStartToOutputPath'
  | 'emailSendToRequired';

export function validateLangchainPipeline(
  nodes: Node[],
  edges: Edge[]
): { ok: boolean; issues: LangchainPipelineValidationIssue[] } {
  const issues: LangchainPipelineValidationIssue[] = [];

  if (nodes.length === 0) {
    issues.push('emptyGraph');
    return { ok: false, issues };
  }

  if (!hasPathFromStartToOutput(nodes, edges)) {
    issues.push('noStartToOutputPath');
  }

  for (const n of nodes) {
    if (n.type === 'emailNode') {
      const d = n.data as LangchainEmailNodeData;
      if (!String(d?.sendTo ?? '').trim()) issues.push('emailSendToRequired');
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
