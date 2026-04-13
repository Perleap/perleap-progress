import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Save,
  BookOpen,
  Calendar,
  Target,
  FileText,
  StickyNote,
  Loader2,
  CalendarRange,
  CheckCircle2,
  SkipForward,
  Clock,
  Pencil,
  Lock,
  Unlock,
  GitBranch,
  Link2,
  Unlink,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateSyllabusSection,
  useUpdateSyllabusSection,
  useDeleteSyllabusSection,
  useReorderSyllabusSections,
  useLinkAssignment,
  useUnlinkAssignment,
  useClassroomAssignments,
} from '@/hooks/queries';
import type { SyllabusSection, SectionResource, ReleaseMode } from '@/types/syllabus';
import { DatePicker } from '@/components/ui/date-picker';
import { ResourceUploader } from './ResourceUploader';
import { ExpandableTextarea } from '@/components/ui/expandable-textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { supabase } from '@/integrations/supabase/client';

/** Supabase assignment ids are UUIDs; reject null/undefined/string "null" from bad Select state. */
const ASSIGNMENT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SyllabusEditorProps {
  syllabusId: string;
  classroomId: string;
  sections: SyllabusSection[];
  structureType: string;
  releaseMode?: ReleaseMode;
  isRTL: boolean;
  sectionResources?: Record<string, SectionResource[]>;
}

export const SyllabusEditor = ({
  syllabusId,
  classroomId,
  sections,
  structureType,
  releaseMode = 'all_at_once',
  isRTL,
  sectionResources = {},
}: SyllabusEditorProps) => {
  const { t, i18n } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [editValues, setEditValues] = useState<Partial<SyllabusSection>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<SyllabusSection | null>(null);
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkDuration, setBulkDuration] = useState(7);
  const [rewritingField, setRewritingField] = useState<string | null>(null);
  const [linkPickerKey, setLinkPickerKey] = useState(0);

  const createMutation = useCreateSyllabusSection();
  const updateMutation = useUpdateSyllabusSection();
  const deleteMutation = useDeleteSyllabusSection();
  const reorderMutation = useReorderSyllabusSections();
  const linkMutation = useLinkAssignment();
  const unlinkMutation = useUnlinkAssignment();
  const { data: allAssignments = [] } = useClassroomAssignments(classroomId);

  const unlinkedAssignmentsForPicker = (allAssignments as { id?: string | null; syllabus_section_id?: string | null }[]).filter(
    (a) => !a.syllabus_section_id && typeof a.id === 'string' && ASSIGNMENT_UUID_RE.test(a.id)
  );

  const clampedIndex = Math.min(selectedIndex, Math.max(sections.length - 1, 0));
  const selected = sections[clampedIndex] ?? null;
  const structureLabel = structureType === 'weeks' ? 'Week' : structureType === 'units' ? 'Unit' : 'Module';

  const getValue = <K extends keyof SyllabusSection>(key: K): SyllabusSection[K] => {
    if (key in editValues) return editValues[key as string] as SyllabusSection[K];
    return selected ? selected[key] : ('' as any);
  };

  const setField = (key: string, value: unknown) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleRewrite = async (fieldKey: 'description' | 'notes', currentValue: string) => {
    if (!currentValue.trim() || !selected) return;
    const fieldId = `${selected.id}-${fieldKey}`;
    setRewritingField(fieldId);
    try {
      const { data: result, error } = await supabase.functions.invoke('rephrase-text', {
        body: { text: currentValue, language: i18n.language === 'he' ? 'he' : 'en' },
      });
      if (error) throw error;
      if (result?.rephrasedText) {
        setField(fieldKey, result.rephrasedText);
        toast.success(t('syllabus.sections.rewriteSuccess', 'Text rewritten'));
      }
    } catch {
      toast.error(t('syllabus.sections.rewriteFailed', 'Failed to rewrite'));
    } finally {
      setRewritingField(null);
    }
  };

  const addSection = () => {
    createMutation.mutate(
      {
        input: {
          syllabus_id: syllabusId,
          title: `${structureLabel} ${sections.length + 1}`,
          description: null,
          content: null,
          order_index: sections.length,
          start_date: null,
          end_date: null,
          objectives: null,
          resources: null,
          notes: null,
          completion_status: 'auto',
          prerequisites: [],
          is_locked: false,
        },
        classroomId,
      },
      {
        onSuccess: () => setSelectedIndex(sections.length),
        onError: () => toast.error(t('syllabus.sections.addFailed')),
      }
    );
  };

  const handleSave = () => {
    if (!selected || Object.keys(editValues).length === 0) return;
    setSaving(true);
    updateMutation.mutate(
      {
        sectionId: selected.id,
        updates: editValues,
        classroomId,
      },
      {
        onSuccess: () => {
          setEditValues({});
          toast.success(t('syllabus.sections.saved'));
        },
        onError: () => toast.error(t('syllabus.sections.saveFailed')),
        onSettled: () => setSaving(false),
      }
    );
  };

  const handleSectionClick = (index: number) => {
    if (Object.keys(editValues).length > 0 && selected) {
      updateMutation.mutate(
        {
          sectionId: selected.id,
          updates: editValues,
          classroomId,
        },
        {
          onSuccess: () => toast.success(t('syllabus.sections.saved')),
          onError: () => toast.error(t('syllabus.sections.saveFailed')),
        }
      );
    }
    setSelectedIndex(index);
    setEditValues({});
  };

  const handleDelete = () => {
    if (!sectionToDelete) return;
    const id = sectionToDelete.id;
    setDeleteConfirmOpen(false);
    setSectionToDelete(null);
    setSelectedIndex(Math.max(0, selectedIndex - 1));
    setEditValues({});
    
    deleteMutation.mutate(
      { sectionId: id, classroomId },
      {
        onSuccess: () => toast.success(t('syllabus.sections.deleted')),
        onError: () => toast.error(t('syllabus.sections.deleteFailed')),
      }
    );
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const ordered = [...sections];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setSelectedIndex(target);
    
    reorderMutation.mutate(
      {
        syllabusId,
        orderedIds: ordered.map((s) => s.id),
        classroomId,
        swapPair: [Math.min(index, target), Math.max(index, target)] as [number, number],
      },
      {
        onError: () => toast.error(t('syllabus.sections.reorderFailed')),
      }
    );
  };

  const handleBulkSchedule = async () => {
    if (!bulkStartDate || sections.length === 0) return;
    setSaving(true);
    try {
      const start = new Date(bulkStartDate);
      for (let i = 0; i < sections.length; i++) {
        const sectionStart = new Date(start);
        sectionStart.setDate(sectionStart.getDate() + i * bulkDuration);
        const sectionEnd = new Date(sectionStart);
        sectionEnd.setDate(sectionEnd.getDate() + bulkDuration - 1);

        await updateMutation.mutateAsync({
          sectionId: sections[i].id,
          updates: {
            start_date: sectionStart.toISOString().split('T')[0],
            end_date: sectionEnd.toISOString().split('T')[0],
          },
          classroomId,
        });
      }
      toast.success(t('syllabus.sections.bulkScheduled'));
      setShowBulkSchedule(false);
      setEditValues({});
    } catch {
      toast.error(t('syllabus.sections.bulkScheduleFailed'));
    } finally {
      setSaving(false);
    }
  };

  const objectives = (getValue('objectives') as string[] | null) || [];

  return (
    <div className="flex gap-6 min-h-[400px]">
      {/* Sidebar */}
      <div className={cn('w-64 flex-shrink-0 flex flex-col', isRTL && 'order-2')}>
        <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h4 className="font-bold text-sm text-foreground">{t('syllabus.sections.title')}</h4>
          <div className="flex items-center gap-1">
            {sections.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowBulkSchedule(!showBulkSchedule)} className="rounded-full gap-1 h-7 text-xs text-muted-foreground">
                <CalendarRange className="h-3 w-3" />
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addSection} disabled={createMutation.isPending} className="rounded-full gap-1 h-7 text-xs">
              <Plus className="h-3 w-3" /> {t('syllabus.sections.add')}
            </Button>
          </div>
        </div>
        {showBulkSchedule && (
          <div className="mb-3 p-3 rounded-xl border border-border bg-card space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('syllabus.sections.autoSchedule')}</p>
            <div className="space-y-1.5">
              <DatePicker value={bulkStartDate} onChange={setBulkStartDate} placeholder={t('syllabus.sections.startDate')} className="rounded-lg h-7 text-xs" />
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={30} value={bulkDuration} onChange={(e) => setBulkDuration(parseInt(e.target.value) || 7)} className="rounded-lg h-7 text-xs w-16" />
                <span className="text-[10px] text-muted-foreground">{t('syllabus.sections.daysPerSection')}</span>
              </div>
            </div>
            <div className="flex justify-end gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowBulkSchedule(false)} className="h-6 text-xs">{t('common.cancel')}</Button>
              <Button type="button" size="sm" onClick={handleBulkSchedule} disabled={saving || !bulkStartDate} className="h-6 text-xs gap-1">
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                {t('syllabus.sections.apply')}
              </Button>
            </div>
          </div>
        )}
        <ScrollArea className="flex-1">
          {sections.length === 0 ? (
            <div className="p-4 border-2 border-dashed border-border rounded-xl bg-muted/10 text-center">
              <p className="text-xs text-muted-foreground">{t('syllabus.sections.noSections')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sections.map((section, index) => (
                <div
                  key={section.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSectionClick(index)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSectionClick(index); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all group text-sm cursor-pointer',
                    selectedIndex === index
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'hover:bg-muted/50 border border-transparent text-foreground',
                    isRTL && 'text-right flex-row-reverse'
                  )}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 opacity-40" />
                  {releaseMode === 'manual' && section.is_locked && (
                    <Lock className="h-3 w-3 text-destructive flex-shrink-0" />
                  )}
                  <span className="flex-1 min-w-0 truncate font-medium">{section.title}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(index, -1); }} disabled={index === 0} className="p-0.5 disabled:opacity-30">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(index, 1); }} disabled={index === sections.length - 1} className="p-0.5 disabled:opacity-30">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Editor Panel */}
      <div className={cn('flex-1 min-w-0', isRTL && 'order-1')}>
        {selected ? (
          <div className="space-y-5">
            <div className={`flex items-center justify-between gap-3 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h4 className="font-bold text-foreground min-w-0 flex-1 truncate">{selected.title}</h4>
              <div className={`flex flex-wrap items-center gap-1.5 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={saving || Object.keys(editValues).length === 0} className="rounded-full gap-1.5 h-8">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {t('syllabus.sections.save')}
                </Button>
                {releaseMode === 'manual' && (
                  <Button
                    type="button"
                    variant={getValue('is_locked') ? 'secondary' : 'outline'}
                    size="sm"
                    className={cn(
                      'rounded-full gap-1.5 h-8',
                      getValue('is_locked') && 'border-destructive/40 text-destructive hover:bg-destructive/10',
                    )}
                    onClick={() => setField('is_locked', !getValue('is_locked'))}
                  >
                    {getValue('is_locked') ? (
                      <>
                        <Unlock className="h-3.5 w-3.5" />
                        {t('syllabus.sections.unlockSection', 'Unlock')}
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        {t('syllabus.sections.lockSection', 'Lock')}
                      </>
                    )}
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => { setSectionToDelete(selected); setDeleteConfirmOpen(true); }} disabled={deleteMutation.isPending} className="rounded-full text-muted-foreground hover:text-destructive h-8 gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> {t('syllabus.sections.delete')}
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1"><BookOpen className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.sectionTitle')}</Label>
                <Input value={getValue('title') as string} onChange={(e) => setField('title', e.target.value)} className="rounded-lg h-9" autoDirection />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1"><FileText className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.description')}</Label>
                <ExpandableTextarea
                  value={(getValue('description') as string) || ''}
                  onChange={(v) => setField('description', v)}
                  rows={3}
                  className="bg-card"
                  autoDirection
                  onRewrite={() => handleRewrite('description', (getValue('description') as string) || '')}
                  isRewriting={rewritingField === `${selected.id}-description`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1"><Pencil className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.content', 'Content')}</Label>
                <RichTextEditor
                  content={(getValue('content') as string) || ''}
                  onChange={(html) => setField('content', html)}
                  placeholder={t('syllabus.sections.contentPlaceholder', 'Add lesson content, instructions, materials...')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.startDate')}</Label>
                  <DatePicker value={(getValue('start_date') as string) || ''} onChange={(v) => setField('start_date', v || null)} placeholder={t('syllabus.sections.startDate')} className="rounded-lg h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.endDate')}</Label>
                  <DatePicker value={(getValue('end_date') as string) || ''} onChange={(v) => setField('end_date', v || null)} placeholder={t('syllabus.sections.endDate')} className="rounded-lg h-8" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.completionStatus')}
                </Label>
                <Select
                  value={(getValue('completion_status') as string) || 'auto'}
                  onValueChange={(v) => setField('completion_status', v)}
                >
                  <SelectTrigger className="rounded-lg h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="auto">
                      <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {t('syllabus.sections.statusAuto')}</span>
                    </SelectItem>
                    <SelectItem value="completed">
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-500" /> {t('syllabus.sections.statusCompleted')}</span>
                    </SelectItem>
                    <SelectItem value="skipped">
                      <span className="flex items-center gap-1.5"><SkipForward className="h-3 w-3 text-orange-500" /> {t('syllabus.sections.statusSkipped')}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1"><Target className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.objectives')}</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setField('objectives', [...objectives, ''])} className="h-6 text-xs text-primary">
                    <Plus className="h-3 w-3 me-0.5" /> {t('syllabus.sections.add')}
                  </Button>
                </div>
                {objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-primary/30" />
                    <Input value={obj} onChange={(e) => { const o = [...objectives]; o[i] = e.target.value; setField('objectives', o); }} className="flex-1 rounded-lg h-7 text-xs" autoDirection />
                    <button type="button" onClick={() => setField('objectives', objectives.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="h-3 w-3" /></button>
                  </div>
                ))}
              </div>

              <ResourceUploader
                sectionId={selected.id}
                classroomId={classroomId}
                resources={sectionResources[selected.id] || []}
                isRTL={isRTL}
              />

              {/* Inline Assignment Linking */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <BookOpen className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.linkedAssignments', 'Assignments')}
                  </Label>
                  <Select
                    key={`link-assignment-${selected.id}-${linkPickerKey}`}
                    onValueChange={(assignmentId) => {
                      if (!assignmentId || !ASSIGNMENT_UUID_RE.test(assignmentId)) return;
                      linkMutation.mutate(
                        { assignmentId, sectionId: selected.id, classroomId },
                        {
                          onSuccess: () => setLinkPickerKey((k) => k + 1),
                          onError: () => toast.error(t('syllabus.sections.linkFailed', 'Failed to link assignment')),
                        }
                      );
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto text-xs rounded-full px-2.5 gap-1 border-dashed">
                      <Link2 className="h-3 w-3 shrink-0" />
                      <SelectValue placeholder={t('syllabus.sections.linkAssignment', 'Link')} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {unlinkedAssignmentsForPicker.map((a) => (
                        <SelectItem key={a.id} value={a.id as string}>
                          {a.title}
                        </SelectItem>
                      ))}
                      {unlinkedAssignmentsForPicker.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          {t('syllabus.sections.noUnlinkedAssignments', 'No unlinked assignments')}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {(allAssignments as any[])
                  .filter((a: any) => a.syllabus_section_id === selected.id)
                  .map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20 text-sm">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 truncate">{a.title}</span>
                      <button
                        type="button"
                        onClick={() => unlinkMutation.mutate(
                          { assignmentId: a.id, classroomId },
                          { onError: () => toast.error(t('syllabus.sections.unlinkFailed', 'Failed to unlink')) }
                        )}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <Unlink className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1"><StickyNote className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.notes')}</Label>
                <ExpandableTextarea
                  value={(getValue('notes') as string) || ''}
                  onChange={(v) => setField('notes', v || null)}
                  rows={2}
                  className="bg-card"
                  autoDirection
                  onRewrite={() => handleRewrite('notes', (getValue('notes') as string) || '')}
                  isRewriting={rewritingField === `${selected.id}-notes`}
                />
              </div>

              {/* Prerequisites (only when release_mode is 'prerequisites') */}
              {releaseMode === 'prerequisites' && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <GitBranch className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.prerequisites', 'Prerequisites')}
                  </Label>
                  <div className="space-y-1">
                    {sections
                      .filter((s) => s.id !== selected.id)
                      .map((s) => {
                        const prereqs = (getValue('prerequisites') as string[] | null) || [];
                        const isChecked = prereqs.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const next = isChecked
                                  ? prereqs.filter((id) => id !== s.id)
                                  : [...prereqs, s.id];
                                setField('prerequisites', next);
                              }}
                              className="rounded"
                            />
                            <span>{s.title}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">{t('syllabus.sections.selectOrAdd')}</p>
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => { setDeleteConfirmOpen(open); if (!open) setSectionToDelete(null); }}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('syllabus.sections.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('syllabus.sections.deleteConfirmDesc', { name: sectionToDelete?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('syllabus.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('syllabus.sections.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
