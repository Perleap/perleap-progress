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
  type NodeChange,
  type EdgeChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
  ReactFlowProvider,
} from '@xyflow/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { useTranslation } from 'react-i18next';
import '@xyflow/react/dist/style.css';
import { LangchainInspector } from './LangchainInspector';
import {
  defaultDataForLangchainNodeType,
  ensureLangchainNodeData,
  isLangchainNodeType,
} from './langchainNodeData';
import { NodePalette } from './NodePalette';
import { InputNode, OutputNode, LLMNode, PromptNode, ChainNode, MemoryNode } from './nodes';
import { cn } from '@/lib/utils';

const nodeTypes: NodeTypes = {
  inputNode: InputNode,
  outputNode: OutputNode,
  llmNode: LLMNode,
  promptNode: PromptNode,
  chainNode: ChainNode,
  memoryNode: MemoryNode,
};

export type LangchainEditorHandle = {
  getPipeline: () => { nodes: Node[]; edges: Edge[] };
};

export interface LangchainEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  /** When set, notifies when the graph node count changes (add/remove nodes). */
  onNodeCountChange?: (count: number) => void;
  readOnly?: boolean;
}

interface LangchainEditorInnerProps extends LangchainEditorProps {
  editorRef?: Ref<LangchainEditorHandle>;
}

const LangchainEditorInner = ({
  initialNodes,
  initialEdges,
  readOnly,
  onNodeCountChange,
  editorRef,
}: LangchainEditorInnerProps) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('he') ?? false;

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useNodesState(initialNodes || []);
  const [edges, setEdges] = useEdgesState(initialEdges || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const prevLenRef = useRef<number>(-1);
  useEffect(() => {
    const n = nodes.length;
    if (prevLenRef.current !== n) {
      prevLenRef.current = n;
      onNodeCountChange?.(n);
    }
  }, [nodes.length, onNodeCountChange]);

  useImperativeHandle(
    editorRef,
    (): LangchainEditorHandle => ({
      getPipeline: () => ({ nodes, edges }),
    }),
    [nodes, edges]
  );

  const onFlowInit = useCallback((rf: ReactFlowInstance) => {
    rf.fitView({ padding: 0.15, maxZoom: 1 });
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds));
    },
    [setEdges]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nextChanges = readOnly
        ? changes.filter((c) => c.type === 'select' || c.type === 'dimensions')
        : changes;
      if (nextChanges.length === 0) return;
      setNodes((nds) => applyNodeChanges(nextChanges, nds));
    },
    [readOnly, setNodes]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.length === 0) return;
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  const onSelectionChange = useCallback(({ nodes: sel }: OnSelectionChangeParams) => {
    setSelectedNodeId(sel.length === 1 ? sel[0].id : null);
  }, []);

  const patchNodeData = useCallback(
    (nodeId: string, partial: Record<string, unknown>) => {
      if (readOnly) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? ensureLangchainNodeData({
                ...n,
                data: { ...n.data, ...partial },
              })
            : n
        )
      );
    },
    [readOnly, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowWrapper.current || !isLangchainNodeType(type)) return;

      const wrapperBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - wrapperBounds.left - 80,
        y: event.clientY - wrapperBounds.top - 20,
      };

      const data = defaultDataForLangchainNodeType(type);

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data,
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [setNodes]
  );

  const selectedNode =
    selectedNodeId !== null ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;

  return (
    <div className={cn('flex h-full min-h-0', isRTL && 'flex-row-reverse')}>
      {!readOnly && (
        <div className="w-48 shrink-0 border-e bg-card p-3 overflow-y-auto">
          <NodePalette />
        </div>
      )}
      <div ref={reactFlowWrapper} className="flex-1 min-w-0 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={readOnly ? undefined : handleEdgesChange}
          onSelectionChange={onSelectionChange}
          onInit={onFlowInit}
          onConnect={readOnly ? undefined : onConnect}
          onDragOver={readOnly ? undefined : onDragOver}
          onDrop={readOnly ? undefined : onDrop}
          nodeTypes={nodeTypes}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          autoPanOnNodeFocus={false}
          nodesFocusable={false}
          zoomOnDoubleClick={false}
          elementsSelectable
          className="bg-muted/20"
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={!readOnly} />
          <MiniMap nodeStrokeWidth={3} zoomable pannable className="!bg-card" />
        </ReactFlow>
      </div>
      <LangchainInspector
        node={selectedNode}
        readOnly={!!readOnly}
        isRTL={isRTL}
        onPatchData={readOnly ? () => {} : patchNodeData}
        className="w-72 shrink-0 min-w-0 border-s"
      />
    </div>
  );
};

/** Must sit under ReactFlowProvider; receives ref forwarded from wrapper. */
const LangchainEditorInnerForwarded = forwardRef<LangchainEditorHandle, LangchainEditorInnerProps>(
  (props, ref) => {
    return <LangchainEditorInner {...props} editorRef={ref} />;
  }
);

export const LangchainEditor = forwardRef<LangchainEditorHandle, LangchainEditorProps>(
  (props, ref) => {
    return (
      <ReactFlowProvider>
        <LangchainEditorInnerForwarded {...props} ref={ref} />
      </ReactFlowProvider>
    );
  }
);
