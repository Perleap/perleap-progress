import { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  type OnNodeClick,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RoadmapNode } from './RoadmapNode';
import { SectionDetailPanel } from './SectionDetailPanel';
import { BookOpen, Plus } from 'lucide-react';
import type { SyllabusSection, SectionStatus, RoadmapNodeData } from '@/types/syllabus';

interface SyllabusRoadmapProps {
  sections: SyllabusSection[];
  assignmentCounts?: Record<string, number>;
  classroomId: string;
  mode?: 'teacher' | 'student';
  onSectionSelect?: (section: SyllabusSection) => void;
  onSwitchToSections?: () => void;
}

const nodeTypes = { syllabusSection: RoadmapNode };

function deriveSectionStatus(section: SyllabusSection): SectionStatus {
  const now = new Date();
  const start = section.start_date ? new Date(section.start_date) : null;
  const end = section.end_date ? new Date(section.end_date) : null;

  if (end && now > end) return 'completed';
  if (start && now >= start) return 'in_progress';
  return 'upcoming';
}

const NODE_SPACING_Y = 160;
const NODE_X = 0;

export const SyllabusRoadmap = ({
  sections,
  assignmentCounts = {},
  classroomId,
  mode = 'teacher',
  onSectionSelect,
  onSwitchToSections,
}: SyllabusRoadmapProps) => {
  const { t } = useTranslation();
  const [selectedSection, setSelectedSection] = useState<SyllabusSection | null>(null);

  const initialNodes: Node<RoadmapNodeData>[] = useMemo(() => {
    return sections.map((section, index) => ({
      id: section.id,
      type: 'syllabusSection',
      position: { x: NODE_X, y: index * NODE_SPACING_Y },
      data: {
        title: section.title,
        description: section.description,
        startDate: section.start_date,
        endDate: section.end_date,
        assignmentCount: assignmentCounts[section.id] || 0,
        orderIndex: section.order_index,
        status: deriveSectionStatus(section),
        sectionId: section.id,
      },
      draggable: false,
      connectable: false,
    }));
  }, [sections, assignmentCounts]);

  const initialEdges: Edge[] = useMemo(() => {
    return sections.slice(1).map((section, index) => ({
      id: `edge-${sections[index].id}-${section.id}`,
      source: sections[index].id,
      target: section.id,
      type: 'smoothstep',
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '0' },
      animated: false,
    }));
  }, [sections]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  const handleNodeClick: OnNodeClick = useCallback(
    (_event, node) => {
      const section = sections.find((s) => s.id === node.id);
      if (section) {
        setSelectedSection(section);
        onSectionSelect?.(section);
      }
    },
    [sections, onSectionSelect]
  );

  if (sections.length === 0) {
    return (
      <Card className="rounded-xl border-dashed border-2 border-border bg-muted/10">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-card rounded-full flex items-center justify-center shadow-sm mb-4">
            <BookOpen className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">{t('syllabus.roadmap.noSections')}</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-5">
            {t('syllabus.roadmap.noSectionsDesc')}
          </p>
          {mode === 'teacher' && onSwitchToSections && (
            <Button onClick={onSwitchToSections} variant="outline" className="rounded-full gap-2">
              <Plus className="h-4 w-4" /> {t('syllabus.roadmap.addSections')}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const flowHeight = Math.max(400, sections.length * NODE_SPACING_Y + 100);

  return (
    <div className="relative">
      <div style={{ height: flowHeight }} className="w-full rounded-xl border border-border bg-muted/10 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          zoomOnScroll={false}
          minZoom={0.5}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
        </ReactFlow>
      </div>

      {selectedSection && (
        <SectionDetailPanel
          section={selectedSection}
          assignmentCount={assignmentCounts[selectedSection.id] || 0}
          onClose={() => setSelectedSection(null)}
        />
      )}
    </div>
  );
};
