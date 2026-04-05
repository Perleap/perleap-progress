import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { InputNode, OutputNode, LLMNode, PromptNode, ChainNode, MemoryNode } from './nodes';
import { NodePalette } from './NodePalette';

const nodeTypes: NodeTypes = {
  inputNode: InputNode,
  outputNode: OutputNode,
  llmNode: LLMNode,
  promptNode: PromptNode,
  chainNode: ChainNode,
  memoryNode: MemoryNode,
};

const DEFAULT_LABEL: Record<string, string> = {
  inputNode: 'User Input',
  outputNode: 'Output',
  llmNode: 'LLM',
  promptNode: 'Prompt Template',
  chainNode: 'Chain',
  memoryNode: 'Memory',
};

interface LangchainEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onChange?: (nodes: Node[], edges: Edge[]) => void;
  readOnly?: boolean;
}

function LangchainEditorInner({ initialNodes, initialEdges, onChange, readOnly }: LangchainEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>(initialNodes || []);
  const edgesRef = useRef<Edge[]>(initialEdges || []);
  const [nodes, setNodes] = useNodesState(initialNodes || []);
  const [edges, setEdges] = useEdgesState(initialEdges || []);

  nodesRef.current = nodes;
  edgesRef.current = edges;

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge({ ...params, animated: true }, eds);
        onChange?.(nodesRef.current, newEdges);
        return newEdges;
      });
    },
    [setEdges, onChange]
  );

  const handleNodesChange: typeof onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        queueMicrotask(() => onChange?.(next, edgesRef.current));
        return next;
      });
    },
    [setNodes, onChange]
  );

  const handleEdgesChange: typeof onEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        queueMicrotask(() => onChange?.(nodesRef.current, next));
        return next;
      });
    },
    [setEdges, onChange]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowWrapper.current) return;

      const wrapperBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - wrapperBounds.left - 80,
        y: event.clientY - wrapperBounds.top - 20,
      };

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: { label: DEFAULT_LABEL[type] || type },
      };

      setNodes((nds) => {
        const updated = [...nds, newNode];
        onChange?.(updated, edgesRef.current);
        return updated;
      });
    },
    [setNodes, onChange]
  );

  return (
    <div className="flex h-full">
      {!readOnly && (
        <div className="w-48 shrink-0 border-r bg-card p-3 overflow-y-auto">
          <NodePalette />
        </div>
      )}
      <div ref={reactFlowWrapper} className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onDragOver={readOnly ? undefined : onDragOver}
          onDrop={readOnly ? undefined : onDrop}
          nodeTypes={nodeTypes}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          fitView
          className="bg-muted/20"
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={!readOnly} />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="!bg-card"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function LangchainEditor(props: LangchainEditorProps) {
  return (
    <ReactFlowProvider>
      <LangchainEditorInner {...props} />
    </ReactFlowProvider>
  );
}
