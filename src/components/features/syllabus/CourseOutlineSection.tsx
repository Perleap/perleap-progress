import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import {
  useSyllabus,
  useCreateSyllabus,
  useUpdateSyllabus,
  usePublishSyllabus,
  useClassroomAssignments,
} from '@/hooks/queries';
import { SyllabusRoadmap } from './SyllabusRoadmap';
import { SyllabusEditor } from './SyllabusEditor';
import { GradingCategoriesManager } from './GradingCategoriesManager';
import { AssignmentLinker } from './AssignmentLinker';
import type { SyllabusStructureType } from '@/types/syllabus';

interface CourseOutlineSectionProps {
  classroomId: string;
  isRTL: boolean;
}

export const CourseOutlineSection = ({ classroomId, isRTL }: CourseOutlineSectionProps) => {
  const { t } = useTranslation();
  const { data: syllabus, isLoading, isError, refetch } = useSyllabus(classroomId);
  const { data: assignments = [] } = useClassroomAssignments(classroomId);
  const createMutation = useCreateSyllabus();
  const updateMutation = useUpdateSyllabus();
  const publishMutation = usePublishSyllabus();

  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSummary, setCreateSummary] = useState('');
  const [createType, setCreateType] = useState<SyllabusStructureType>('weeks');

  const [activeTab, setActiveTab] = useState('roadmap');
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaSummary, setMetaSummary] = useState('');
  const [metaStructureType, setMetaStructureType] = useState<SyllabusStructureType>('weeks');
  const [metaGradingPolicy, setMetaGradingPolicy] = useState('');
  const [metaAttendancePolicy, setMetaAttendancePolicy] = useState('');
  const [metaLateWorkPolicy, setMetaLateWorkPolicy] = useState('');
  const [metaCommunicationPolicy, setMetaCommunicationPolicy] = useState('');

  const assignmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (assignments as any[]).forEach((a: any) => {
      if (a.syllabus_section_id) {
        counts[a.syllabus_section_id] = (counts[a.syllabus_section_id] || 0) + 1;
      }
    });
    return counts;
  }, [assignments]);

  const handleCreate = async () => {
    if (!createTitle.trim()) {
      toast.error(t('syllabus.titleRequired'));
      return;
    }
    try {
      await createMutation.mutateAsync({
        classroom_id: classroomId,
        title: createTitle,
        summary: createSummary || null,
        structure_type: createType,
        grading_policy_text: null,
        attendance_policy_text: null,
        late_work_policy_text: null,
        communication_policy_text: null,
        status: 'draft',
      });
      toast.success(t('syllabus.syllabusCreated'));
      setShowCreate(false);
      setCreateTitle('');
      setCreateSummary('');
    } catch {
      toast.error(t('syllabus.createFailed'));
    }
  };

  const handlePublish = async () => {
    if (!syllabus) return;
    try {
      await publishMutation.mutateAsync({ syllabusId: syllabus.id, classroomId });
      toast.success(t('syllabus.published'));
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

  const startEditMeta = () => {
    if (!syllabus) return;
    setMetaTitle(syllabus.title);
    setMetaSummary(syllabus.summary || '');
    setMetaStructureType(syllabus.structure_type);
    setMetaGradingPolicy(syllabus.grading_policy_text || '');
    setMetaAttendancePolicy(syllabus.attendance_policy_text || '');
    setMetaLateWorkPolicy(syllabus.late_work_policy_text || '');
    setMetaCommunicationPolicy(syllabus.communication_policy_text || '');
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
          grading_policy_text: metaGradingPolicy || null,
          attendance_policy_text: metaAttendancePolicy || null,
          late_work_policy_text: metaLateWorkPolicy || null,
          communication_policy_text: metaCommunicationPolicy || null,
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
          <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-full">
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
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-full">{t('syllabus.cancel')}</Button>
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
            <Button variant="outline" size="sm" onClick={handleRevertToDraft} disabled={updateMutation.isPending} className="rounded-full gap-1.5">
              {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Edit className="h-3.5 w-3.5" />}
              {t('syllabus.revertToDraft')}
            </Button>
          )}
        </div>
      </div>

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
            classroomId={classroomId}
            onSwitchToSections={() => setActiveTab('sections')}
          />
        </TabsContent>

        <TabsContent value="sections">
          <SyllabusEditor
            syllabusId={syllabus.id}
            classroomId={classroomId}
            sections={syllabus.sections}
            structureType={syllabus.structure_type}
            isRTL={isRTL}
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
            metaGradingPolicy={metaGradingPolicy}
            metaAttendancePolicy={metaAttendancePolicy}
            metaLateWorkPolicy={metaLateWorkPolicy}
            metaCommunicationPolicy={metaCommunicationPolicy}
            onChangeTitle={setMetaTitle}
            onChangeSummary={setMetaSummary}
            onChangeStructureType={setMetaStructureType}
            onChangeGradingPolicy={setMetaGradingPolicy}
            onChangeAttendancePolicy={setMetaAttendancePolicy}
            onChangeLateWorkPolicy={setMetaLateWorkPolicy}
            onChangeCommunicationPolicy={setMetaCommunicationPolicy}
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

import type { SyllabusWithSections } from '@/types/syllabus';

function SyllabusSettings({
  syllabus,
  editingMeta,
  onStartEdit,
  onSave,
  onCancel,
  saving,
  metaTitle, metaSummary, metaStructureType,
  metaGradingPolicy, metaAttendancePolicy, metaLateWorkPolicy, metaCommunicationPolicy,
  onChangeTitle, onChangeSummary, onChangeStructureType,
  onChangeGradingPolicy, onChangeAttendancePolicy, onChangeLateWorkPolicy, onChangeCommunicationPolicy,
  isRTL,
}: {
  syllabus: SyllabusWithSections;
  editingMeta: boolean;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  metaTitle: string; metaSummary: string; metaStructureType: SyllabusStructureType;
  metaGradingPolicy: string; metaAttendancePolicy: string; metaLateWorkPolicy: string; metaCommunicationPolicy: string;
  onChangeTitle: (v: string) => void; onChangeSummary: (v: string) => void; onChangeStructureType: (v: SyllabusStructureType) => void;
  onChangeGradingPolicy: (v: string) => void; onChangeAttendancePolicy: (v: string) => void; onChangeLateWorkPolicy: (v: string) => void; onChangeCommunicationPolicy: (v: string) => void;
  isRTL: boolean;
}) {
  const { t } = useTranslation();

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
              <SettingsField label={t('syllabus.settings.status')} value={syllabus.status} isRTL={isRTL} />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border shadow-sm">
            <CardContent className="p-5 space-y-4">
              <SettingsField label={t('syllabus.settings.gradingPolicy')} value={syllabus.grading_policy_text || '—'} isRTL={isRTL} />
              <SettingsField label={t('syllabus.settings.lateWorkPolicy')} value={syllabus.late_work_policy_text || '—'} isRTL={isRTL} />
              <SettingsField label={t('syllabus.settings.attendancePolicy')} value={syllabus.attendance_policy_text || '—'} isRTL={isRTL} />
              <SettingsField label={t('syllabus.settings.communicationPolicy')} value={syllabus.communication_policy_text || '—'} isRTL={isRTL} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('syllabus.settings.gradingPolicy')}</Label>
              <Textarea value={metaGradingPolicy} onChange={(e) => onChangeGradingPolicy(e.target.value)} rows={2} className="rounded-lg resize-none text-sm" autoDirection />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('syllabus.settings.lateWorkPolicy')}</Label>
              <Textarea value={metaLateWorkPolicy} onChange={(e) => onChangeLateWorkPolicy(e.target.value)} rows={2} className="rounded-lg resize-none text-sm" autoDirection />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('syllabus.settings.attendancePolicy')}</Label>
              <Textarea value={metaAttendancePolicy} onChange={(e) => onChangeAttendancePolicy(e.target.value)} rows={2} className="rounded-lg resize-none text-sm" autoDirection />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('syllabus.settings.communicationPolicy')}</Label>
              <Textarea value={metaCommunicationPolicy} onChange={(e) => onChangeCommunicationPolicy(e.target.value)} rows={2} className="rounded-lg resize-none text-sm" autoDirection />
            </div>
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
      <p className={cn('text-sm text-foreground', isRTL ? 'text-right' : 'text-left')}>{value}</p>
    </div>
  );
}
