import { useMemo, useCallback, useState, useEffect, useRef, useLayoutEffect, type MouseEvent } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  type ReactFlowInstance,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RoadmapNode } from './RoadmapNode';
import { SectionDetailModal } from './SectionDetailModal';
import { BookOpen, Plus, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  SyllabusSection,
  RoadmapNodeData,
  SectionResource,
  CompletionStatus,
  StudentProgressStatus,
  ReleaseMode,
  SyllabusStructureType,
} from '@/types/syllabus';
import { isSectionUnlocked } from '@/lib/sectionUnlock';
import {
  deriveSectionStatus,
  isTodayInDateRange,
  filterRoadmapSections,
  deriveCurrentSectionDisplayIndex,
  roadmapProgressPercent,
  type RoadmapSectionFilter,
} from './syllabusRoadmapUtils';

interface SyllabusRoadmapProps {
  sections: SyllabusSection[];
  assignmentCounts?: Record<string, number>;
  sectionResources?: Record<string, SectionResource[]>;
  classroomId: string;
  mode?: 'teacher' | 'student';
  isRTL?: boolean;
  syllabusId?: string;
  releaseMode?: ReleaseMode;
  /** Shown in roadmap caption (e.g. Weeks · All at once) */
  structureType?: SyllabusStructureType;
  studentProgressMap?: Record<string, StudentProgressStatus>;
  linkedAssignmentsMap?: Record<string, Array<{ id: string; title: string; type: string; due_at: string | null }>>;
  onSectionSelect?: (section: SyllabusSection) => void;
  onSwitchToSections?: () => void;
}

const nodeTypes = { syllabusSection: RoadmapNode };

const NODE_SPACING_Y = 188;
const NODE_APPX_HEIGHT = 168;
const EMPTY_OBJECT: Record<string, unknown> = {};

function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    mq.addEventListener('change', handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export const SyllabusRoadmap = ({
  sections,
  assignmentCounts = EMPTY_OBJECT as Record<string, number>,
  sectionResources = EMPTY_OBJECT as Record<string, SectionResource[]>,
  classroomId: _classroomId,
  mode = 'teacher',
  isRTL = false,
  syllabusId,
  releaseMode = 'all_at_once',
  structureType,
  studentProgressMap = EMPTY_OBJECT as Record<string, StudentProgressStatus>,
  linkedAssignmentsMap = EMPTY_OBJECT as Record<
    string,
    Array<{ id: string; title: string; type: string; due_at: string | null }>
  >,
  onSectionSelect,
  onSwitchToSections,
}: SyllabusRoadmapProps) => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [selectedSection, setSelectedSection] = useState<SyllabusSection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<RoadmapSectionFilter>('all');
  const [activeJumpId, setActiveJumpId] = useState<string | null>(null);
  const [nodeWidth, setNodeWidth] = useState(400);
  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const flowContainerRef = useRef<HTMLDivElement | null>(null);
  const isMdUp = useMatchMedia('(min-width: 768px)');

  const filteredSections = useMemo(
    () =>
      filterRoadmapSections(
        sections,
        filter,
        mode,
        assignmentCounts,
        sectionResources as Record<string, unknown[]>,
        releaseMode,
        studentProgressMap
      ),
    [sections, filter, mode, assignmentCounts, sectionResources, releaseMode, studentProgressMap]
  );

  const statuses = useMemo(
    () => filteredSections.map((s) => deriveSectionStatus(s)),
    [filteredSections]
  );

  const progressPct = useMemo(() => roadmapProgressPercent(statuses), [statuses]);
  const currentIdx = useMemo(() => deriveCurrentSectionDisplayIndex(statuses), [statuses]);

  useEffect(() => {
    const el = flowContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 400;
      const next = Math.max(280, Math.min(560, Math.round(w * 0.92)));
      setNodeWidth(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zigzag = isMdUp;

  const initialNodes: Node<RoadmapNodeData>[] = useMemo(() => {
    const gap = Math.max(260, Math.round(nodeWidth * 0.82));
    return filteredSections.map((section, index) => {
      const locked =
        mode === 'student' &&
        !isSectionUnlocked(section, sections, releaseMode, studentProgressMap);
      const x =
        !zigzag
          ? 0
          : isRTL
            ? index % 2 === 0
              ? gap
              : 0
            : index % 2 === 0
              ? 0
              : gap;
      return {
        id: section.id,
        type: 'syllabusSection',
        position: { x, y: index * NODE_SPACING_Y },
        data: {
          title: section.title,
          description: section.description,
          startDate: section.start_date,
          endDate: section.end_date,
          assignmentCount: assignmentCounts[section.id] || 0,
          resourceCount: (sectionResources[section.id] || []).length,
          orderIndex: section.order_index,
          sectionIndex: index + 1,
          nodeWidth,
          enterDelayMs: index * 45,
          status: deriveSectionStatus(section),
          sectionId: section.id,
          completionStatus: (section.completion_status || 'auto') as CompletionStatus,
          studentProgress: studentProgressMap[section.id],
          locked,
          isTodayInRange: isTodayInDateRange(section.start_date, section.end_date),
        },
        draggable: false,
        connectable: false,
      };
    });
  }, [
    filteredSections,
    sections,
    assignmentCounts,
    sectionResources,
    studentProgressMap,
    mode,
    releaseMode,
    nodeWidth,
    zigzag,
    isRTL,
  ]);

  const thenLabel = t('syllabus.roadmap.then');

  const initialEdges: Edge[] = useMemo(() => {
    return filteredSections.slice(1).map((section, index) => ({
      id: `edge-${filteredSections[index].id}-${section.id}`,
      source: filteredSections[index].id,
      target: section.id,
      type: 'smoothstep',
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 3, strokeDasharray: '0' },
      animated: false,
      label: thenLabel,
      labelStyle: { fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 6,
      labelBgStyle: { fill: 'hsl(var(--card))', fillOpacity: 0.95 },
    }));
  }, [filteredSections, thenLabel]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<RoadmapNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const refit = useCallback(() => {
    const inst = rfInstance.current;
    if (!inst || filteredSections.length === 0) return;
    requestAnimationFrame(() => {
      inst.fitView({
        padding: 0.18,
        maxZoom: 1.15,
        minZoom: 0.45,
        duration: 200,
        includeHiddenNodes: false,
      });
    });
  }, [filteredSections.length]);

  useLayoutEffect(() => {
    refit();
  }, [refit, nodeWidth, zigzag, filter, filteredSections.length]);

  const handleNodeClick = useCallback(
    (_event: MouseEvent, node: Node<RoadmapNodeData>) => {
      const section = sections.find((s) => s.id === node.id);
      if (!section) return;
      const locked =
        mode === 'student' &&
        !isSectionUnlocked(section, sections, releaseMode, studentProgressMap);
      if (locked) return;
      setActiveJumpId(node.id);
      setSelectedSection(section);
      setModalOpen(true);
      onSectionSelect?.(section);
    },
    [sections, onSectionSelect, mode, releaseMode, studentProgressMap]
  );

  const focusSection = useCallback(
    (sectionId: string) => {
      const inst = rfInstance.current;
      if (!inst) return;
      const n = inst.getNode(sectionId);
      if (!n) return;
      setActiveJumpId(sectionId);
      const x = n.position.x + nodeWidth / 2;
      const y = n.position.y + NODE_APPX_HEIGHT / 2;
      inst.setCenter(x, y, { zoom: 1, duration: 250 });
    },
    [nodeWidth]
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

  const selectedStatus = selectedSection ? deriveSectionStatus(selectedSection) : 'upcoming';

  const caption =
    structureType != null
      ? `${t(`syllabus.${structureType}`)} · ${t(`syllabus.releaseMode.${releaseMode}`, releaseMode)}`
      : t(`syllabus.releaseMode.${releaseMode}`, releaseMode);

  const showTeacherTips = mode === 'teacher' && sections.length >= 1 && sections.length <= 3;

  const filterButtons: { key: RoadmapSectionFilter; show: boolean }[] = [
    { key: 'all', show: true },
    { key: 'assignments', show: true },
    { key: 'resources', show: mode === 'teacher' },
    { key: 'locked', show: mode === 'student' },
  ];

  const legendItems: { key: string; labelKey: string; dotClass: string }[] = [
    { key: 'upcoming', labelKey: 'syllabus.roadmap.upcoming', dotClass: 'bg-muted-foreground/40' },
    { key: 'in_progress', labelKey: 'syllabus.roadmap.inProgress', dotClass: 'bg-primary' },
    { key: 'completed', labelKey: 'syllabus.roadmap.completed', dotClass: 'bg-green-500' },
    { key: 'skipped', labelKey: 'syllabus.roadmap.skipped', dotClass: 'bg-orange-400' },
  ];
  if (mode === 'student') {
    legendItems.push({
      key: 'locked',
      labelKey: 'syllabus.sections.locked',
      dotClass: 'bg-muted-foreground/50',
    });
  }

  return (
    <div className="relative space-y-4">
      {showTeacherTips && (
        <Card className="rounded-xl border-primary/20 bg-primary/[0.04]">
          <CardContent className={`p-4 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className="font-semibold text-foreground mb-2">{t('syllabus.roadmap.teacherTipsTitle')}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-3">
              <li>{t('syllabus.roadmap.teacherTipDates')}</li>
              <li>{t('syllabus.roadmap.teacherTipAssignments')}</li>
              <li>{t('syllabus.roadmap.teacherTipPublish')}</li>
            </ul>
            {onSwitchToSections && (
              <Button variant="outline" size="sm" className="rounded-full" onClick={onSwitchToSections}>
                {t('syllabus.roadmap.goToSections')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className={`space-y-3 ${isRTL ? 'text-right' : 'text-left'}`}>
        <p className="text-sm text-muted-foreground">{caption}</p>
        <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'justify-end' : ''}`}>
          {legendItems.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('size-2 rounded-full shrink-0', item.dotClass)} />
              {t(item.labelKey)}
            </span>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t('syllabus.roadmap.progressLine', {
                current: currentIdx,
                total: filteredSections.length || sections.length,
              })}
            </p>
            <Progress value={progressPct} className="max-w-md w-full h-2" />
          </div>
          <div className={cn('flex flex-wrap gap-1.5', isRTL && 'sm:flex-row-reverse')}>
            {filterButtons
              .filter((b) => b.show)
              .map(({ key }) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={filter === key ? 'default' : 'outline'}
                  className="rounded-full h-8 text-xs"
                  onClick={() => setFilter(key)}
                >
                  {t(`syllabus.roadmap.filter.${key}`)}
                </Button>
              ))}
          </div>
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border bg-muted/10">
          <CardContent className={`p-6 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
            <p className="text-muted-foreground mb-3">{t('syllabus.roadmap.filterEmpty')}</p>
            <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => setFilter('all')}>
              {t('syllabus.roadmap.filterReset')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
          <div className="hidden md:block rounded-xl border border-border bg-card/50 p-3 max-h-[min(70vh,820px)] overflow-y-auto">
            <div className={`flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <List className="h-3.5 w-3.5" />
              {t('syllabus.roadmap.jumpListTitle')}
            </div>
            <ul className="space-y-1">
              {filteredSections.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => focusSection(s.id)}
                    className={cn(
                      'w-full rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/80',
                      isRTL ? 'text-end' : 'text-start',
                      activeJumpId === s.id && 'bg-primary/10 text-primary font-medium'
                    )}
                  >
                    <span className="line-clamp-2">{s.title || t('syllabus.sections.sectionTitle')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div
            ref={flowContainerRef}
            className="w-full min-h-[560px] h-[min(70vh,820px)] rounded-xl border border-border bg-muted/10 overflow-hidden"
          >
            <ReactFlow
              colorMode={resolvedTheme === 'dark' ? 'dark' : 'light'}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              onInit={(instance) => {
                rfInstance.current = instance;
                requestAnimationFrame(() => refit());
              }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              panOnScroll
              zoomOnScroll={false}
              minZoom={0.45}
              maxZoom={1.35}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
              <Controls showInteractive={false} className="!bg-card !border-border !shadow-sm" />
              <MiniMap
                nodeStrokeWidth={2}
                zoomable
                pannable
                className="!bg-card/95 !border-border"
                maskColor="hsl(var(--background) / 0.65)"
                nodeColor={(n) => {
                  const st = (n.data as RoadmapNodeData | undefined)?.status;
                  if (st === 'completed') return 'hsl(142 76% 36%)';
                  if (st === 'in_progress') return 'hsl(var(--primary))';
                  if (st === 'skipped') return 'hsl(27 96% 61%)';
                  return 'hsl(var(--muted-foreground))';
                }}
              />
            </ReactFlow>
          </div>
        </div>
      )}

      <SectionDetailModal
        section={selectedSection}
        open={modalOpen}
        onOpenChange={setModalOpen}
        assignmentCount={selectedSection ? (assignmentCounts[selectedSection.id] || 0) : 0}
        resources={selectedSection ? (sectionResources[selectedSection.id] || []) : []}
        sectionStatus={selectedStatus}
        mode={mode}
        isRTL={isRTL}
        syllabusId={syllabusId}
        studentProgress={selectedSection ? studentProgressMap[selectedSection.id] : undefined}
        linkedAssignments={selectedSection ? (linkedAssignmentsMap[selectedSection.id] || []) : []}
      />
    </div>
  );
};
