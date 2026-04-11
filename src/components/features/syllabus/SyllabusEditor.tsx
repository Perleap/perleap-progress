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
} from 'lucide-react';
import {
  useCreateSyllabusSection,
  useUpdateSyllabusSection,
  useDeleteSyllabusSection,
  useReorderSyllabusSections,
} from '@/hooks/queries';
import type { SyllabusSection } from '@/types/syllabus';

interface SyllabusEditorProps {
  syllabusId: string;
  classroomId: string;
  sections: SyllabusSection[];
  structureType: string;
  isRTL: boolean;
}

export const SyllabusEditor = ({
  syllabusId,
  classroomId,
  sections,
  structureType,
  isRTL,
}: SyllabusEditorProps) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [editValues, setEditValues] = useState<Partial<SyllabusSection>>({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const createMutation = useCreateSyllabusSection();
  const updateMutation = useUpdateSyllabusSection();
  const deleteMutation = useDeleteSyllabusSection();
  const reorderMutation = useReorderSyllabusSections();

  const selected = sections[selectedIndex] ?? null;
  const structureLabel = structureType === 'weeks' ? 'Week' : structureType === 'units' ? 'Unit' : 'Module';

  const getValue = <K extends keyof SyllabusSection>(key: K): SyllabusSection[K] => {
    if (key in editValues) return editValues[key as string] as SyllabusSection[K];
    return selected ? selected[key] : ('' as any);
  };

  const setField = (key: string, value: unknown) => {
    setEditValues((prev) => ({ ...prev, [key]: value }));
  };

  const addSection = async () => {
    try {
      await createMutation.mutateAsync({
        input: {
          syllabus_id: syllabusId,
          title: `${structureLabel} ${sections.length + 1}`,
          description: null,
          order_index: sections.length,
          start_date: null,
          end_date: null,
          objectives: null,
          resources: null,
          notes: null,
        },
        classroomId,
      });
      setSelectedIndex(sections.length);
    } catch {
      toast.error(t('syllabus.sections.addFailed'));
    }
  };

  const handleSave = async () => {
    if (!selected || Object.keys(editValues).length === 0) return;
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        sectionId: selected.id,
        updates: editValues,
        classroomId,
      });
      setEditValues({});
      toast.success(t('syllabus.sections.saved'));
    } catch {
      toast.error(t('syllabus.sections.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await deleteMutation.mutateAsync({ sectionId: selected.id, classroomId });
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      setEditValues({});
      setDeleteConfirmOpen(false);
      toast.success(t('syllabus.sections.deleted'));
    } catch {
      toast.error(t('syllabus.sections.deleteFailed'));
    }
  };

  const moveSection = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const ordered = [...sections];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    try {
      await reorderMutation.mutateAsync({
        syllabusId,
        orderedIds: ordered.map((s) => s.id),
        classroomId,
      });
      setSelectedIndex(target);
    } catch {
      toast.error(t('syllabus.sections.reorderFailed'));
    }
  };

  const objectives = (getValue('objectives') as string[] | null) || [];

  return (
    <div className="flex gap-6 min-h-[400px]">
      {/* Sidebar */}
      <div className={cn('w-64 flex-shrink-0 flex flex-col', isRTL && 'order-2')}>
        <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h4 className="font-bold text-sm text-foreground">{t('syllabus.sections.title')}</h4>
          <Button type="button" variant="outline" size="sm" onClick={addSection} disabled={createMutation.isPending} className="rounded-full gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" /> {t('syllabus.sections.add')}
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {sections.length === 0 ? (
            <div className="p-4 border-2 border-dashed border-border rounded-xl bg-muted/10 text-center">
              <p className="text-xs text-muted-foreground">{t('syllabus.sections.noSections')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => { setSelectedIndex(index); setEditValues({}); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all group text-sm',
                    selectedIndex === index
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'hover:bg-muted/50 border border-transparent text-foreground',
                    isRTL && 'text-right flex-row-reverse'
                  )}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 opacity-40" />
                  <span className="flex-1 min-w-0 truncate font-medium">{section.title}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(index, -1); }} disabled={index === 0} className="p-0.5 disabled:opacity-30">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(index, 1); }} disabled={index === sections.length - 1} className="p-0.5 disabled:opacity-30">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Editor Panel */}
      <div className={cn('flex-1 min-w-0', isRTL && 'order-1')}>
        {selected ? (
          <div className="space-y-5">
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h4 className="font-bold text-foreground">{selected.title}</h4>
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={handleSave} disabled={saving || Object.keys(editValues).length === 0} className="rounded-full gap-1.5 h-8">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {t('syllabus.sections.save')}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)} disabled={deleteMutation.isPending} className="rounded-full text-muted-foreground hover:text-destructive h-8 gap-1">
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
                <Textarea value={(getValue('description') as string) || ''} onChange={(e) => setField('description', e.target.value)} rows={3} className="rounded-lg resize-none text-sm" autoDirection />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.startDate')}</Label>
                  <Input type="date" value={(getValue('start_date') as string) || ''} onChange={(e) => setField('start_date', e.target.value || null)} className="rounded-lg h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.endDate')}</Label>
                  <Input type="date" value={(getValue('end_date') as string) || ''} onChange={(e) => setField('end_date', e.target.value || null)} className="rounded-lg h-8" />
                </div>
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

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1"><FileText className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.resources')}</Label>
                <Textarea value={(getValue('resources') as string) || ''} onChange={(e) => setField('resources', e.target.value || null)} rows={2} className="rounded-lg resize-none text-xs" autoDirection />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1"><StickyNote className="h-3 w-3 text-muted-foreground" /> {t('syllabus.sections.notes')}</Label>
                <Textarea value={(getValue('notes') as string) || ''} onChange={(e) => setField('notes', e.target.value || null)} rows={2} className="rounded-lg resize-none text-xs" autoDirection />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">{t('syllabus.sections.selectOrAdd')}</p>
          </div>
        )}
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('syllabus.sections.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('syllabus.sections.deleteConfirmDesc', { name: selected?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('syllabus.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? t('common.loading') : t('syllabus.sections.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
