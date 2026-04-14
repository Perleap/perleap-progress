import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Plus,
  BookOpen,
  GraduationCap,
  Map,
  Edit,
  Send,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
  Save,
  Settings,
  Archive,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useSyllabus,
  useCreateSyllabus,
  useUpdateSyllabus,
  usePublishSyllabus,
  useArchiveSyllabus,
  useClassroomAssignments,
} from '@/hooks/queries';
import { SyllabusRoadmap } from './SyllabusRoadmap';
import { SyllabusEditor } from './SyllabusEditor';
import { GradingCategoriesManager } from './GradingCategoriesManager';
import { AssignmentLinker } from './AssignmentLinker';
import { SyllabusPDFExport } from './SyllabusPDFExport';
import type { SyllabusStructureType, SyllabusPolicy, ReleaseMode } from '@/types/syllabus';
import { useAuth } from '@/contexts/AuthContext';
import { runSyllabusPublishedSideEffects } from '@/lib/syllabusPublishSideEffects';

interface CourseOutlineSectionProps {
  classroomId: string;
  isRTL: boolean;
}

export const CourseOutlineSection = ({ classroomId, isRTL }: CourseOutlineSectionProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: syllabus, isLoading, isError, refetch } = useSyllabus(classroomId);
  const { data: assignments = [] } = useClassroomAssignments(classroomId);
  const createMutation = useCreateSyllabus();
  const updateMutation = useUpdateSyllabus();
  const publishMutation = usePublishSyllabus();
  const archiveMutation = useArchiveSyllabus();

  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSummary, setCreateSummary] = useState('');
  const [createType, setCreateType] = useState<SyllabusStructureType>('weeks');
  const [createInitialPublish, setCreateInitialPublish] = useState<'draft' | 'published'>('draft');

  const [activeTab, setActiveTab] = useState('roadmap');
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaSummary, setMetaSummary] = useState('');
  const [metaStructureType, setMetaStructureType] = useState<SyllabusStructureType>('weeks');
  const [metaPolicies, setMetaPolicies] = useState<SyllabusPolicy[]>([]);
  const [metaReleaseMode, setMetaReleaseMode] = useState<ReleaseMode>('all_at_once');

  const assignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (assignments as any[]).forEach((a: any) => {
      if (a.syllabus_section_id) {
        counts[a.syllabus_section_id] = (counts[a.syllabus_section_id] || 0) + 1;
      }
    });
    return counts;
  }, [assignments]);

  const linkedAssignmentsMap = useMemo(() => {
    const map: Record<string, Array<{ id: string; title: string; type: string; due_at: string | null }>> = {};
    (assignments as any[]).forEach((a: any) => {
      if (a.syllabus_section_id) {
        if (!map[a.syllabus_section_id]) map[a.syllabus_section_id] = [];
        map[a.syllabus_section_id].push({ id: a.id, title: a.title, type: a.type, due_at: a.due_at });
      }
    });
    return map;
  }, [assignments]);

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      toast.error(t('syllabus.titleRequired'));
      return;
    }
    try {
      const status = createInitialPublish === 'published' ? 'published' : 'draft';
      const created = await createMutation.mutateAsync({
        classroom_id: classroomId,
        title: createTitle,
        summary: createSummary || null,
        structure_type: createType,
        policies: [],
        status,
        release_mode: 'all_at_once',
      });
      if (status === 'published' && created) {
        await runSyllabusPublishedSideEffects(t, {
          classroomId,
          syllabusId: created.id,
          syllabusTitle: created.title,
          sectionsCount: 0,
          userId: user?.id,
          wasAlreadyPublished: false,
        });
      }
      toast.success(t('syllabus.syllabusCreated'));
      setShowCreate(false);
      setCreateTitle('');
      setCreateSummary('');
      setCreateInitialPublish('draft');
    } catch {
      toast.error(t('syllabus.createFailed'));
    }
  };

  const handlePublish = async () => {
    if (!syllabus) return;
    try {
      const wasAlreadyPublished = syllabus.published_at !== null;
      await publishMutation.mutateAsync({ syllabusId: syllabus.id, classroomId });
      toast.success(t('syllabus.published'));

      await runSyllabusPublishedSideEffects(t, {
        classroomId,
        syllabusId: syllabus.id,
        syllabusTitle: syllabus.title,
        sectionsCount: syllabus.sections.length,
        userId: user?.id,
        wasAlreadyPublished,
      });
    } catch {
      toast.error(t('syllabus.publishFailed'));
    }
  };

  const handleRevertToDraft = async () => {
    if (!syllabus) return;
    try {
      await updateMutation.mutateAsync({
        syllabusId: syllabus.id,
        updates: { status: 'draft', published_at: null },
        classroomId,
      });
      toast.success(t('syllabus.revertedToDraft'));
    } catch {
      toast.error(t('syllabus.revertFailed'));
    }
  };

  const handleArchive = async () => {
    if (!syllabus) return;
    if (!confirm(t('syllabus.archiveConfirm'))) return;
    try {
      await archiveMutation.mutateAsync({ syllabusId: syllabus.id, classroomId });
      toast.success(t('syllabus.archived'));
    } catch {
      toast.error(t('syllabus.archiveFailed'));
    }
  };

  const startEditMeta = () => {
    if (!syllabus) return;
    setMetaTitle(syllabus.title);
    setMetaSummary(syllabus.summary || '');
    setMetaStructureType(syllabus.structure_type);
    setMetaPolicies(syllabus.policies ?? []);
    setMetaReleaseMode(syllabus.release_mode || 'all_at_once');
    setEditingMeta(true);
  };

  const handleSaveMeta = async () => {
    if (!syllabus) return;
    try {
      await updateMutation.mutateAsync({
        syllabusId: syllabus.id,
        updates: {
          title: metaTitle,
          summary: metaSummary || null,
          structure_type: metaStructureType,
          policies: metaPolicies.map((p, i) => ({ ...p, order_index: i })),
          release_mode: metaReleaseMode,
        },
        classroomId,
      });
      setEditingMeta(false);
      toast.success(t('syllabus.updated'));
    } catch {
      toast.error(t('syllabus.updateFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h2 className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('syllabus.courseOutline')}
        </h2>
        <Card className="rounded-xl border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-2">{t('syllabus.loadFailed')}</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {t('syllabus.loadFailedDesc')}
            </p>
            <Button onClick={() => refetch()} variant="outline" className="rounded-full gap-2">
              <RefreshCw className="h-4 w-4" /> {t('syllabus.retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state
  if (!syllabus && !showCreate) {
    return (
      <div className="space-y-6">
        <h2 className={`text-2xl md:text-3xl font-bold text-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('syllabus.courseOutline')}
        </h2>
        <Card className="rounded-xl border-dashed border-2 border-border bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center shadow-sm mb-4">
              <Map className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{t('syllabus.noSyllabusYet')}</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              {t('syllabus.noSyllabusDesc')}
            </p>
            <Button onClick={() => setShowCreate(true)} className="rounded-full gap-2">
              <Plus className="h-4 w-4" /> {t('syllabus.createSyllabus')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Create form
  if (!syllabus && showCreate) {
    return (
      <div className="space-y-6">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-2xl font-bold text-foreground">{t('syllabus.createSyllabus')}</h2>
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreate(false);
              setCreateInitialPublish('draft');
            }}
            className="rounded-full"
          >
            <X className="h-4 w-4 me-1" /> {t('syllabus.cancel')}
          </Button>
        </div>
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="font-medium">{t('syllabus.title')}</Label>
              <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder={t('syllabus.titlePlaceholder')} className="rounded-xl" autoDirection />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">{t('syllabus.summary')}</Label>
              <Textarea value={createSummary} onChange={(e) => setCreateSummary(e.target.value)} placeholder={t('syllabus.summaryPlaceholder')} rows={3} className="rounded-xl resize-none" autoDirection />
            </div>
            <div className="space-y-2">
              <Label className="font-medium">{t('syllabus.structureType')}</Label>
              <div className="grid grid-cols-3 gap-3">
                {(['weeks', 'units', 'modules'] as const).map((sType) => (
                  <button key={sType} type="button" onClick={() => setCreateType(sType)} className={cn('p-3 rounded-xl border-2 text-center transition-all', createType === sType ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                    <span className="font-bold text-sm">{t(`syllabus.${sType}`)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3 pt-1">
              <Label className={`font-medium ${isRTL ? 'text-right block' : ''}`}>
                {t('syllabus.initialPublish.label')}
              </Label>
              <RadioGroup
                value={createInitialPublish}
                onValueChange={(v) => setCreateInitialPublish(v as 'draft' | 'published')}
              >
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-accent/50 transition-colors',
                    isRTL && 'flex-row-reverse'
                  )}
                >
                  <RadioGroupItem value="draft" id="outline-create-draft" className="shrink-0" />
                  <Label
                    htmlFor="outline-create-draft"
                    className={cn(
                      'mb-0 cursor-pointer font-normal flex-1',
                      isRTL ? 'text-right' : 'text-left'
                    )}
                  >
                    <span className="font-medium">{t('syllabus.initialPublish.draft')}</span>
                  </Label>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-accent/50 transition-colors',
                    isRTL && 'flex-row-reverse'
                  )}
                >
                  <RadioGroupItem value="published" id="outline-create-published" className="shrink-0" />
                  <Label
                    htmlFor="outline-create-published"
                    className={cn(
                      'mb-0 cursor-pointer font-normal flex-1',
                      isRTL ? 'text-right' : 'text-left'
                    )}
                  >
                    <span className="font-medium">{t('syllabus.initialPublish.publish')}</span>
                  </Label>
                </div>
              </RadioGroup>
              <p className={cn('text-xs text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>
                {t('syllabus.initialPublish.helper')}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreate(false);
                  setCreateInitialPublish('draft');
                }}
                className="rounded-full"
              >
                {t('syllabus.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !createTitle.trim()} className="rounded-full gap-2">
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('syllabus.createSyllabus')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!syllabus) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4`}>
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">{t('syllabus.courseOutline')}</h2>
            <Badge
              variant={syllabus.status === 'published' ? 'default' : 'secondary'}
              className={cn(
                'rounded-full',
                syllabus.status === 'published'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : ''
              )}
            >
              {syllabus.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{syllabus.title}</p>
        </div>

        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {syllabus.status === 'draft' && (
            <div className="flex items-center gap-2">
              {syllabus.sections.length === 0 && (
                <span className="text-xs text-muted-foreground">{t('syllabus.addSectionsFirst')}</span>
              )}
              <Button variant="default" size="sm" onClick={handlePublish} disabled={publishMutation.isPending || syllabus.sections.length === 0} className="rounded-full gap-1.5">
                {publishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {t('syllabus.publish')}
              </Button>
            </div>
          )}
          {syllabus.status === 'published' && (
            <>
              <Button variant="outline" size="sm" onClick={handleRevertToDraft} disabled={updateMutation.isPending} className="rounded-full gap-1.5">
                {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Edit className="h-3.5 w-3.5" />}
                {t('syllabus.revertToDraft')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleArchive} disabled={archiveMutation.isPending} className="rounded-full gap-1.5 text-muted-foreground hover:text-destructive">
                {archiveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                {t('syllabus.archive')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* PDF Export */}
      <SyllabusPDFExport syllabus={syllabus} isRTL={isRTL} />

      {/* Summary Card */}
      {syllabus.summary && (
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-4">
            <p className={`text-sm text-foreground/80 ${isRTL ? 'text-right' : 'text-left'}`}>{syllabus.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs (using shadcn Tabs for proper a11y) */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 rounded-xl p-1 h-auto w-fit">
          <TabsTrigger value="roadmap" className="rounded-lg gap-1.5 px-4 py-2 text-sm">
            <Map className="h-4 w-4" /> {t('syllabus.tabs.roadmap')}
          </TabsTrigger>
          <TabsTrigger value="sections" className="rounded-lg gap-1.5 px-4 py-2 text-sm">
            <BookOpen className="h-4 w-4" /> {t('syllabus.tabs.sections')}
          </TabsTrigger>
          <TabsTrigger value="grading" className="rounded-lg gap-1.5 px-4 py-2 text-sm">
            <GraduationCap className="h-4 w-4" /> {t('syllabus.tabs.grading')}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="rounded-lg gap-1.5 px-4 py-2 text-sm">
            <Edit className="h-4 w-4" /> {t('syllabus.tabs.assignments')}
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg gap-1.5 px-4 py-2 text-sm">
            <Settings className="h-4 w-4" /> {t('syllabus.tabs.settings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap">
          <SyllabusRoadmap
            sections={syllabus.sections}
            assignmentCounts={assignmentCounts}
            sectionResources={syllabus.section_resources}
            classroomId={classroomId}
            mode="teacher"
            isRTL={isRTL}
            syllabusId={syllabus.id}
            structureType={syllabus.structure_type}
            releaseMode={syllabus.release_mode || 'all_at_once'}
            linkedAssignmentsMap={linkedAssignmentsMap}
            onSwitchToSections={() => setActiveTab('sections')}
          />
        </TabsContent>

        <TabsContent value="sections">
          <SyllabusEditor
            syllabusId={syllabus.id}
            classroomId={classroomId}
            sections={syllabus.sections}
            structureType={syllabus.structure_type}
            releaseMode={syllabus.release_mode || 'all_at_once'}
            isRTL={isRTL}
            sectionResources={syllabus.section_resources}
          />
        </TabsContent>

        <TabsContent value="grading">
          <GradingCategoriesManager
            syllabusId={syllabus.id}
            classroomId={classroomId}
            categories={syllabus.grading_categories}
            isRTL={isRTL}
          />
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentLinker
            classroomId={classroomId}
            sections={syllabus.sections}
            gradingCategories={syllabus.grading_categories}
            assignments={assignments as any[]}
            isRTL={isRTL}
          />
        </TabsContent>

        <TabsContent value="settings">
          <SyllabusSettings
            syllabus={syllabus}
            editingMeta={editingMeta}
            onStartEdit={startEditMeta}
            onSave={handleSaveMeta}
            onCancel={() => setEditingMeta(false)}
            saving={updateMutation.isPending}
            metaTitle={metaTitle}
            metaSummary={metaSummary}
            metaStructureType={metaStructureType}
            metaPolicies={metaPolicies}
            metaReleaseMode={metaReleaseMode}
            onChangeTitle={setMetaTitle}
            onChangeSummary={setMetaSummary}
            onChangeStructureType={setMetaStructureType}
            onChangePolicies={setMetaPolicies}
            onChangeReleaseMode={setMetaReleaseMode}
            isRTL={isRTL}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Settings sub-component (metadata editing)
// ---------------------------------------------------------------------------

import type { SyllabusWithSections, SyllabusPolicyType, ReleaseMode as ReleaseModeType } from '@/types/syllabus';
import { ChangelogViewer } from './ChangelogViewer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getPolicyIcon, getPolicyColor } from './steps/SyllabusSetupStep';
import { ReleaseModeSelect } from './ReleaseModeSelect';
import {
  GraduationCap as GradIcon,
  BookOpen as AttIcon,
  FileWarning as LateIcon,
  MessageCircle as CommIcon,
  Shield as IntegrityIcon,
  Users as ParticIcon,
  Award as CreditIcon,
  PenLine,
  Check,
  Trash2,
  Scale,
} from 'lucide-react';

const SETTINGS_PRESETS: { type: SyllabusPolicyType; labelKey: string; fallbackLabel: string; icon: typeof GradIcon; colorClass: string }[] = [
  { type: 'grading', labelKey: 'syllabus.policies.grading', fallbackLabel: 'Grading Policy', icon: GradIcon, colorClass: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
  { type: 'attendance', labelKey: 'syllabus.policies.attendance', fallbackLabel: 'Attendance Policy', icon: AttIcon, colorClass: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
  { type: 'late_work', labelKey: 'syllabus.policies.lateWork', fallbackLabel: 'Late Work Policy', icon: LateIcon, colorClass: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30' },
  { type: 'communication', labelKey: 'syllabus.policies.communication', fallbackLabel: 'Communication Policy', icon: CommIcon, colorClass: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30' },
  { type: 'academic_integrity', labelKey: 'syllabus.policies.academicIntegrity', fallbackLabel: 'Academic Integrity', icon: IntegrityIcon, colorClass: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
  { type: 'participation', labelKey: 'syllabus.policies.participation', fallbackLabel: 'Participation', icon: ParticIcon, colorClass: 'text-teal-500 bg-teal-100 dark:bg-teal-900/30' },
  { type: 'extra_credit', labelKey: 'syllabus.policies.extraCredit', fallbackLabel: 'Extra Credit', icon: CreditIcon, colorClass: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30' },
];

function SyllabusSettings({
  syllabus,
  editingMeta,
  onStartEdit,
  onSave,
  onCancel,
  saving,
  metaTitle, metaSummary, metaStructureType,
  metaPolicies,
  metaReleaseMode,
  onChangeTitle, onChangeSummary, onChangeStructureType,
  onChangePolicies,
  onChangeReleaseMode,
  isRTL,
}: {
  syllabus: SyllabusWithSections;
  editingMeta: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  metaTitle: string; metaSummary: string; metaStructureType: SyllabusStructureType;
  metaPolicies: SyllabusPolicy[];
  metaReleaseMode: ReleaseModeType;
  onChangeTitle: (v: string) => void; onChangeSummary: (v: string) => void; onChangeStructureType: (v: SyllabusStructureType) => void;
  onChangePolicies: (v: SyllabusPolicy[]) => void;
  onChangeReleaseMode: (v: ReleaseModeType) => void;
  isRTL: boolean;
}) {
  const { t } = useTranslation();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const policies = editingMeta ? metaPolicies : (syllabus.policies ?? []);

  if (!editingMeta) {
    return (
      <div className="space-y-6">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-bold text-foreground text-lg">{t('syllabus.settings.title')}</h3>
          <Button variant="outline" size="sm" onClick={onStartEdit} className="rounded-full gap-1.5">
            <Edit className="h-3.5 w-3.5" /> {t('syllabus.settings.edit')}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-xl border-border shadow-sm">
            <CardContent className="p-5 space-y-4">
              <SettingsField label={t('syllabus.title')} value={syllabus.title} isRTL={isRTL} />
              <SettingsField label={t('syllabus.summary')} value={syllabus.summary || '—'} isRTL={isRTL} />
              <SettingsField label={t('syllabus.settings.structure')} value={syllabus.structure_type} isRTL={isRTL} />
              <SettingsField label={t('syllabus.releaseMode.label', 'Release Mode')} value={t(`syllabus.releaseMode.${syllabus.release_mode || 'all_at_once'}`, syllabus.release_mode || 'all_at_once')} isRTL={isRTL} />
              <SettingsField label={t('syllabus.settings.status')} value={syllabus.status} isRTL={isRTL} />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border shadow-sm">
            <CardContent className="p-5 space-y-4">
              {policies.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('syllabus.policies.noPolicies', 'No policies defined.')}</p>
              ) : (
                policies.map((p) => (
                  <SettingsField key={p.id} label={p.label} value={p.content || '—'} isRTL={isRTL} />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <ChangelogViewer syllabusId={syllabus.id} isRTL={isRTL} />
      </div>
    );
  }

  const addedTypes = new Set(metaPolicies.map((p) => p.type));

  const addPolicy = (type: SyllabusPolicyType, label: string) => {
    onChangePolicies([
      ...metaPolicies,
      { id: crypto.randomUUID(), type, label, content: '', order_index: metaPolicies.length },
    ]);
    setPopoverOpen(false);
  };

  const updatePolicy = (id: string, partial: Partial<SyllabusPolicy>) => {
    onChangePolicies(metaPolicies.map((p) => (p.id === id ? { ...p, ...partial } : p)));
  };

  const removePolicy = (id: string) => {
    onChangePolicies(metaPolicies.filter((p) => p.id !== id).map((p, i) => ({ ...p, order_index: i })));
  };

  return (
    <div className="space-y-6">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className="font-bold text-foreground text-lg">{t('syllabus.settings.editTitle')}</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-full">{t('syllabus.settings.cancel')}</Button>
          <Button variant="default" size="sm" onClick={onSave} disabled={saving} className="rounded-full gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('syllabus.settings.save')}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('syllabus.title')}</Label>
              <Input value={metaTitle} onChange={(e) => onChangeTitle(e.target.value)} className="rounded-lg" autoDirection />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('syllabus.summary')}</Label>
              <Textarea value={metaSummary} onChange={(e) => onChangeSummary(e.target.value)} rows={3} className="rounded-lg resize-none" autoDirection />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('syllabus.structureType')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['weeks', 'units', 'modules'] as const).map((sType) => (
                  <button key={sType} type="button" onClick={() => onChangeStructureType(sType)} className={cn('p-2 rounded-lg border-2 text-center text-sm transition-all', metaStructureType === sType ? 'border-primary bg-primary/5 font-bold' : 'border-border hover:border-primary/40')}>
                    {t(`syllabus.${sType}`)}
                  </button>
                ))}
              </div>
            </div>
            <ReleaseModeSelect
              label={t('syllabus.releaseMode.label', 'Release Mode')}
              value={metaReleaseMode}
              onChange={(v) => onChangeReleaseMode(v as ReleaseModeType)}
              triggerClassName="rounded-lg"
            />
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Label className="text-sm font-medium">{t('syllabus.wizard.policies')}</Label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger className="inline-flex items-center justify-center gap-1 rounded-full h-7 px-2.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer">
                  <Plus className="h-3 w-3" /> {t('syllabus.policies.addPolicy', 'Add')}
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2 rounded-xl" sideOffset={8}>
                  <div className="space-y-0.5">
                    {SETTINGS_PRESETS.map((preset) => {
                      const PIco = preset.icon;
                      const alreadyAdded = addedTypes.has(preset.type);
                      return (
                        <button
                          key={preset.type}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => addPolicy(preset.type, t(preset.labelKey, preset.fallbackLabel))}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                            alreadyAdded ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/60 cursor-pointer',
                            isRTL && 'flex-row-reverse text-right'
                          )}
                        >
                          <div className={cn('p-1 rounded-md', preset.colorClass)}><PIco className="h-3 w-3" /></div>
                          <span className="flex-1 font-medium text-foreground text-xs">{t(preset.labelKey, preset.fallbackLabel)}</span>
                          {alreadyAdded && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      );
                    })}
                    <div className="border-t border-border my-1" />
                    <button
                      type="button"
                      onClick={() => addPolicy('custom', t('syllabus.policies.customPolicy', 'Custom Policy'))}
                      className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-muted/60', isRTL && 'flex-row-reverse text-right')}
                    >
                      <div className="p-1 rounded-md text-gray-500 bg-gray-100 dark:bg-gray-900/30"><PenLine className="h-3 w-3" /></div>
                      <span className="flex-1 font-medium text-foreground text-xs">{t('syllabus.policies.customPolicy', 'Custom Policy')}</span>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {metaPolicies.length === 0 ? (
              <div className="p-6 border-2 border-dashed border-border rounded-lg bg-muted/10 text-center">
                <Scale className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">{t('syllabus.policies.noPolicies', 'No policies added yet.')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {metaPolicies.map((policy) => {
                  const PIco = getPolicyIcon(policy.type);
                  const clr = getPolicyColor(policy.type);
                  return (
                    <div key={policy.id} className="space-y-1.5 p-3 rounded-lg border border-border bg-card">
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={cn('p-1 rounded-md', clr)}><PIco className="h-3 w-3" /></div>
                        {policy.type === 'custom' ? (
                          <Input
                            value={policy.label}
                            onChange={(e) => updatePolicy(policy.id, { label: e.target.value })}
                            className="flex-1 h-7 text-xs rounded-md"
                            autoDirection
                          />
                        ) : (
                          <span className="flex-1 text-xs font-medium text-foreground">{policy.label}</span>
                        )}
                        <Button type="button" variant="ghost" size="icon" onClick={() => removePolicy(policy.id)} className="h-6 w-6 text-muted-foreground hover:text-destructive rounded-full">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Textarea
                        value={policy.content}
                        onChange={(e) => updatePolicy(policy.id, { content: e.target.value })}
                        rows={2}
                        className="rounded-md resize-none text-sm"
                        autoDirection
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingsField({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return (
    <div>
      <span className={`text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>{label}</span>
      <p className={cn('text-sm text-foreground whitespace-pre-wrap', isRTL ? 'text-right' : 'text-left')}>{value}</p>
    </div>
  );
}
