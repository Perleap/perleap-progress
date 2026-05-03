import { describe, expect, it } from 'vitest';
import {
  LANGCHAIN_PIPELINE_SCHEMA_VERSION,
  isLangchainNodeType,
  parsePipelineJson,
  serializePipeline,
  truncateLangchainPreview,
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

  it('normalizes unknown node types so React Flow always has a registered type', () => {
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
    expect(nodes[0].type).toBe('chainNode');
    expect((nodes[0].data as { label: string }).label).toContain('default');
    expect(nodes[1].type).toBe('chainNode');
    expect((nodes[1].data as { label: string }).label).toContain('unset');
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
