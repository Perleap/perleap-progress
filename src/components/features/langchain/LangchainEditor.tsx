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
  type EdgeTypes,
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
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PanelRightOpen } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { DeletableEdge } from './DeletableEdge';
import { LangchainEditorProvider } from './LangchainEditorContext';
import { LangchainFlowCoordsBridge, type FlowCoordsBridge } from './LangchainFlowCoordsBridge';
import { LangchainInspector } from './LangchainInspector';
import {
  defaultDataForLangchainNodeType,
  ensureLangchainNodeData,
  isLangchainNodeType,
} from './langchainNodeData';
import { NodePalette } from './NodePalette';
import { InputNode, OutputNode, LLMNode, TriggerNode, EmailNode } from './nodes';
import { cn } from '@/lib/utils';
import type { AssignmentClipboardTrackingCallbacks } from '@/hooks/useAssignmentClipboardTracking';

const nodeTypes: NodeTypes = {
  inputNode: InputNode,
  outputNode: OutputNode,
  llmNode: LLMNode,
  triggerNode: TriggerNode,
  emailNode: EmailNode,
};

const edgeTypes: EdgeTypes = {
  deletable: DeletableEdge,
};

export type LangchainEditorHandle = {
  getPipeline: () => { nodes: Node[]; edges: Edge[] };
};

export interface LangchainEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  /** When set, notifies when the graph node count changes (add/remove nodes). */
  onNodeCountChange?: (count: number) => void;
  /** Fired on meaningful graph edits (not selection-only). */
  onUserActivity?: () => void;
  readOnly?: boolean;
  clipboardTracking?: AssignmentClipboardTrackingCallbacks;
}

interface LangchainEditorInnerProps extends LangchainEditorProps {
  editorRef?: Ref<LangchainEditorHandle>;
}

const LangchainEditorInner = ({
  initialNodes,
  initialEdges,
  readOnly,
  onNodeCountChange,
  onUserActivity,
  clipboardTracking,
  editorRef,
}: LangchainEditorInnerProps) => {
  const { i18n, t } = useTranslation();
  const isRTL = i18n.language?.startsWith('he') ?? false;

  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const flowCoordsBridgeRef = useRef<FlowCoordsBridge | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useNodesState(initialNodes || []);
  const [edges, setEdges] = useEdgesState(initialEdges || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);

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

  const onFlowInit = useCallback(
    (rf: ReactFlowInstance) => {
      reactFlowInstanceRef.current = rf;
      if ((initialNodes?.length ?? 0) > 0) {
        requestAnimationFrame(() => {
          rf.fitView({ padding: 0.15, maxZoom: 1 });
        });
      } else {
        rf.setViewport({ x: 0, y: 0, zoom: 1 });
      }
    },
    [initialNodes?.length]
  );

  const notifyUserActivity = useCallback(() => {
    onUserActivity?.();
  }, [onUserActivity]);

  const isMeaningfulNodeChange = (changes: NodeChange[]) =>
    changes.some(
      (c) =>
        c.type === 'add' ||
        c.type === 'remove' ||
        c.type === 'replace' ||
        (c.type === 'position' && c.dragging === false),
    );

  const isMeaningfulEdgeChange = (changes: EdgeChange[]) =>
    changes.some((c) => c.type === 'add' || c.type === 'remove' || c.type === 'replace');

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: 'deletable', animated: true }, eds));
      notifyUserActivity();
    },
    [setEdges, notifyUserActivity],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nextChanges = readOnly
        ? changes.filter((c) => c.type === 'select' || c.type === 'dimensions')
        : changes;
      if (nextChanges.length === 0) return;

      if (!readOnly && isMeaningfulNodeChange(nextChanges)) {
        notifyUserActivity();
      }

      const removedIds = new Set(
        nextChanges.filter((c) => c.type === 'remove').map((c) => c.id)
      );
      if (removedIds.size > 0 && selectedNodeId && removedIds.has(selectedNodeId)) {
        setSelectedNodeId(null);
      }

      setNodes((nds) => applyNodeChanges(nextChanges, nds));
    },
    [readOnly, selectedNodeId, setNodes, notifyUserActivity],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.length === 0) return;

      if (!readOnly && isMeaningfulEdgeChange(changes)) {
        notifyUserActivity();
      }

      const removedIds = new Set(
        changes.filter((c) => c.type === 'remove').map((c) => c.id)
      );
      if (removedIds.size > 0 && selectedEdgeId && removedIds.has(selectedEdgeId)) {
        setSelectedEdgeId(null);
      }

      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [selectedEdgeId, setEdges, readOnly, notifyUserActivity],
  );

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
    setSelectedNodeId(selNodes.length === 1 ? selNodes[0].id : null);
    setSelectedEdgeId(selEdges.length === 1 ? selEdges[0].id : null);
  }, []);

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (readOnly) return;
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
    },
    [readOnly, selectedNodeId, setNodes, setEdges]
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      if (readOnly) return;
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
    },
    [readOnly, selectedEdgeId, setEdges]
  );

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
      notifyUserActivity();
    },
    [readOnly, setNodes, notifyUserActivity],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !isLangchainNodeType(type)) return;

      const client = { x: event.clientX, y: event.clientY };
      const rfInit = reactFlowInstanceRef.current;
      const rfBridge = flowCoordsBridgeRef.current;
      const paneBounds = (event.currentTarget as HTMLElement)?.getBoundingClientRect?.();

      const positionFromInit = rfInit?.screenToFlowPosition(client) ?? null;
      const positionFromBridge = rfBridge?.screenToFlowPosition(client) ?? null;
      const viewportBridge = rfBridge?.getViewport() ?? null;

      let manualFromPane: { x: number; y: number } | null = null;
      if (paneBounds && viewportBridge) {
        manualFromPane = {
          x: (client.x - paneBounds.left - viewportBridge.x) / viewportBridge.zoom,
          y: (client.y - paneBounds.top - viewportBridge.y) / viewportBridge.zoom,
        };
      }

      const position = positionFromBridge ?? positionFromInit ?? manualFromPane;
      if (!position) return;

      const data = defaultDataForLangchainNodeType(type);

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data,
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newNode.id);
      notifyUserActivity();
    },
    [setNodes, notifyUserActivity]
  );

  const editorContextValue = useMemo(
    () => ({
      readOnly: !!readOnly,
      onDeleteNode: deleteNode,
      onDeleteEdge: deleteEdge,
    }),
    [readOnly, deleteNode, deleteEdge]
  );

  const selectedNode =
    selectedNodeId !== null ? (nodes.find((n) => n.id === selectedNodeId) ?? null) : null;

  const flowEdges = useMemo(
    () => (readOnly ? edges.map((e) => ({ ...e, selectable: false })) : edges),
    [edges, readOnly]
  );

  return (
    <LangchainEditorProvider value={editorContextValue}>
      <div className={cn('flex h-full min-h-0', isRTL && 'flex-row-reverse')}>
        {!readOnly && (
          <div className="w-40 shrink-0 border-e bg-card p-2.5 overflow-y-auto">
            <NodePalette />
          </div>
        )}

        <div ref={canvasWrapperRef} className="relative flex-1 min-w-0 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={flowEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={readOnly ? undefined : handleEdgesChange}
            onSelectionChange={onSelectionChange}
            onInit={onFlowInit}
            onConnect={readOnly ? undefined : onConnect}
            onDragOver={readOnly ? undefined : onDragOver}
            onDrop={readOnly ? undefined : onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'deletable', animated: true }}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : 'Backspace'}
            edgesFocusable={!readOnly}
            autoPanOnNodeFocus={false}
            nodesFocusable={false}
            zoomOnDoubleClick={false}
            elementsSelectable
            className="bg-muted/20"
          >
            <LangchainFlowCoordsBridge bridgeRef={flowCoordsBridgeRef} />
            <Background gap={16} size={1} />
            <Controls showInteractive={!readOnly} />
            <MiniMap nodeStrokeWidth={3} zoomable pannable className="!bg-card" />
          </ReactFlow>
        </div>

        <div
          className={cn(
            'flex shrink-0 flex-col min-h-0 bg-card',
            isRTL ? 'border-e' : 'border-s',
            inspectorOpen ? 'w-64' : 'w-9'
          )}
        >
          {inspectorOpen ? (
            <LangchainInspector
              node={selectedNode}
              readOnly={!!readOnly}
              isRTL={isRTL}
              onPatchData={readOnly ? () => {} : patchNodeData}
              onToggleCollapse={readOnly ? undefined : () => setInspectorOpen(false)}
              clipboardTracking={clipboardTracking}
              className="min-w-0 min-h-0 flex-1 overflow-hidden"
            />
          ) : (
            <div className="flex shrink-0 justify-center border-b px-1 py-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setInspectorOpen(true)}
                title={t('assignmentDetail.langchain.actions.expandInspector')}
                aria-label={t('assignmentDetail.langchain.actions.expandInspector')}
              >
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </LangchainEditorProvider>
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
