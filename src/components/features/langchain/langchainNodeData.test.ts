import { describe, expect, it } from 'vitest';
import {
  LANGCHAIN_PIPELINE_SCHEMA_VERSION,
  hasPathFromStartToOutput,
  isLangchainNodeType,
  parsePipelineJson,
  serializePipeline,
  truncateLangchainPreview,
  validateLangchainPipeline,
} from '@/components/features/langchain/langchainNodeData';
import type { Edge, Node } from '@xyflow/react';

describe('parsePipelineJson', () => {
  it('returns empty for null, empty, invalid JSON', () => {
    expect(parsePipelineJson(null)).toEqual({ nodes: [], edges: [] });
    expect(parsePipelineJson('')).toEqual({ nodes: [], edges: [] });
    expect(parsePipelineJson('not json')).toEqual({ nodes: [], edges: [] });
  });

  it('parses legacy shape { nodes, edges }', () => {
    const text = JSON.stringify({
      nodes: [
        {
          id: 'inputNode_1',
          type: 'inputNode',
          position: { x: 0, y: 0 },
          data: { label: 'Legacy' },
        },
      ],
      edges: [],
    });
    const { nodes, edges } = parsePipelineJson(text);
    expect(edges).toEqual([]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('inputNode');
    const data = nodes[0].data as { label: string; description: string };
    expect(data.label).toBe('Legacy');
    expect(data.description).toBe('');
  });

  it('parses v1 envelope with schemaVersion', () => {
    const n: Node[] = [
      {
        id: 'o1',
        type: 'outputNode',
        position: { x: 1, y: 2 },
        data: { label: 'Out', description: 'd' },
      },
    ];
    const e: Edge[] = [];
    const text = serializePipeline(n, e);
    const parsed = JSON.parse(text);
    expect(parsed.schemaVersion).toBe(LANGCHAIN_PIPELINE_SCHEMA_VERSION);
    const round = parsePipelineJson(text);
    expect(round.edges).toEqual(e);
    expect(round.nodes).toHaveLength(1);
    expect(round.nodes[0].id).toBe('o1');
    expect(round.nodes[0].type).toBe('outputNode');
    expect((round.nodes[0].data as { description: string }).description).toBe('d');
  });

  it('normalizes unknown node types to llmNode', () => {
    const text = JSON.stringify({
      schemaVersion: LANGCHAIN_PIPELINE_SCHEMA_VERSION,
      nodes: [
        {
          id: 'n1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'X' },
        },
        {
          id: 'n2',
          position: { x: 1, y: 1 },
          data: {},
        },
      ],
      edges: [],
    });
    const { nodes } = parsePipelineJson(text);
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => isLangchainNodeType(n.type))).toBe(true);
    expect(nodes[0].type).toBe('llmNode');
    expect((nodes[0].data as { label: string }).label).toContain('X');
    expect(nodes[1].type).toBe('llmNode');
  });

  it('normalizes legacy prompt/chain/memory nodes to llmNode', () => {
    const text = JSON.stringify({
      nodes: [
        {
          id: 'p1',
          type: 'promptNode',
          position: { x: 0, y: 0 },
          data: { label: 'My Prompt', template: 'Hello {{name}}' },
        },
        {
          id: 'c1',
          type: 'chainNode',
          position: { x: 1, y: 0 },
          data: { label: 'Step Chain', description: 'Runs steps' },
        },
        {
          id: 'm1',
          type: 'memoryNode',
          position: { x: 2, y: 0 },
          data: { label: 'Chat Memory', strategy: 'buffer', description: 'Keeps history' },
        },
      ],
      edges: [],
    });
    const { nodes } = parsePipelineJson(text);
    expect(nodes.every((n) => n.type === 'llmNode')).toBe(true);
    expect((nodes[0].data as { label: string }).label).toContain('Legacy Prompt');
    expect((nodes[0].data as { systemPrompt: string }).systemPrompt).toContain('Hello {{name}}');
    expect((nodes[1].data as { label: string }).label).toContain('Legacy Chain');
    expect((nodes[2].data as { label: string }).label).toContain('Legacy Memory');
  });

  it('maps legacy systemOrRoleNote to systemPrompt on llmNode', () => {
    const text = JSON.stringify({
      nodes: [
        {
          id: 'l1',
          type: 'llmNode',
          position: { x: 0, y: 0 },
          data: { label: 'LLM', systemOrRoleNote: 'You are helpful.' },
        },
      ],
      edges: [],
    });
    const { nodes } = parsePipelineJson(text);
    expect((nodes[0].data as { systemPrompt: string }).systemPrompt).toBe('You are helpful.');
  });
});

describe('truncateLangchainPreview', () => {
  it('truncates long text with ellipsis', () => {
    expect(truncateLangchainPreview('abcdef', 4)).toBe('abc…');
    expect(truncateLangchainPreview('hello world', 100)).toBe('hello world');
  });

  it('normalizes whitespace', () => {
    expect(truncateLangchainPreview('  a  b  ', 10)).toBe('a b');
  });
});

describe('hasPathFromStartToOutput', () => {
  const trigger: Node = {
    id: 't1',
    type: 'triggerNode',
    position: { x: 0, y: 0 },
    data: { label: 'Trigger', mode: 'incoming_mail' },
  };
  const output: Node = {
    id: 'o1',
    type: 'outputNode',
    position: { x: 0, y: 100 },
    data: { label: 'Output', description: '' },
  };
  const edge: Edge = { id: 'e1', source: 't1', target: 'o1' };

  it('accepts trigger-to-output path', () => {
    expect(hasPathFromStartToOutput([trigger, output], [edge])).toBe(true);
  });

  it('rejects graph with no start-to-output path', () => {
    expect(hasPathFromStartToOutput([trigger, output], [])).toBe(false);
  });
});

describe('validateLangchainPipeline', () => {
  const trigger: Node = {
    id: 't1',
    type: 'triggerNode',
    position: { x: 0, y: 0 },
    data: { label: 'Trigger', mode: 'incoming_mail' },
  };
  const llm: Node = {
    id: 'l1',
    type: 'llmNode',
    position: { x: 0, y: 50 },
    data: { label: 'LLM', systemPrompt: '' },
  };
  const output: Node = {
    id: 'o1',
    type: 'outputNode',
    position: { x: 0, y: 100 },
    data: { label: 'Output', description: '' },
  };
  const edges: Edge[] = [
    { id: 'e1', source: 't1', target: 'l1' },
    { id: 'e2', source: 'l1', target: 'o1' },
  ];

  it('passes trigger-only path to output', () => {
    const result = validateLangchainPipeline([trigger, llm, output], edges);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('requires sendTo on email nodes', () => {
    const email: Node = {
      id: 'em1',
      type: 'emailNode',
      position: { x: 0, y: 75 },
      data: { label: 'Email', sendTo: '' },
    };
    const emailEdges: Edge[] = [
      { id: 'e1', source: 't1', target: 'em1' },
      { id: 'e2', source: 'em1', target: 'o1' },
    ];
    const result = validateLangchainPipeline([trigger, email, output], emailEdges);
    expect(result.ok).toBe(false);
    expect(result.issues).toContain('emailSendToRequired');
  });
});
