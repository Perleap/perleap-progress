import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Copy,
  BookOpen,
  Calendar,
  Target,
  FileText,
  StickyNote,
} from 'lucide-react';
import type { WizardData, WizardSectionData } from '../CreateClassroomWizard';

interface OutlineBuilderStepProps {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  isRTL: boolean;
}

const createEmptySection = (): WizardSectionData => ({
  tempId: crypto.randomUUID(),
  title: '',
  description: '',
  objectives: [''],
  startDate: '',
  endDate: '',
  resources: '',
  notes: '',
});

export const OutlineBuilderStep = ({ data, onChange, isRTL }: OutlineBuilderStepProps) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const sections = data.sections;
  const selected = sections[selectedIndex] ?? null;

  const structureLabel =
    data.structureType === 'weeks' ? 'Week' : data.structureType === 'units' ? 'Unit' : 'Module';

  const addSection = () => {
    const newSection = createEmptySection();
    newSection.title = `${structureLabel} ${sections.length + 1}`;
    const updated = [...sections, newSection];
    onChange({ sections: updated });
    setSelectedIndex(updated.length - 1);
  };

  const duplicateSection = (index: number) => {
    const src = sections[index];
    const dup: WizardSectionData = {
      ...src,
      tempId: crypto.randomUUID(),
      title: `${src.title} (copy)`,
    };
    const updated = [...sections.slice(0, index + 1), dup, ...sections.slice(index + 1)];
    onChange({ sections: updated });
    setSelectedIndex(index + 1);
  };

  const removeSection = (index: number) => {
    const updated = sections.filter((_, i) => i !== index);
    onChange({ sections: updated });
    setSelectedIndex(Math.min(selectedIndex, Math.max(updated.length - 1, 0)));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const updated = [...sections];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onChange({ sections: updated });
    setSelectedIndex(target);
  };

  const updateSection = (index: number, partial: Partial<WizardSectionData>) => {
    const updated = sections.map((s, i) => (i === index ? { ...s, ...partial } : s));
    onChange({ sections: updated });
  };

  const addObjective = () => {
    if (selected) {
      updateSection(selectedIndex, { objectives: [...selected.objectives, ''] });
    }
  };

  const updateObjective = (objIndex: number, value: string) => {
    if (!selected) return;
    const objs = [...selected.objectives];
    objs[objIndex] = value;
    updateSection(selectedIndex, { objectives: objs });
  };

  const removeObjective = (objIndex: number) => {
    if (!selected) return;
    updateSection(selectedIndex, { objectives: selected.objectives.filter((_, i) => i !== objIndex) });
  };

  return (
    <div className="flex gap-6 min-h-[500px]">
      {/* Left Sidebar — Section List */}
      <div className={cn('w-72 flex-shrink-0 flex flex-col', isRTL && 'order-2')}>
        <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-bold text-foreground">{t('syllabus.sections.title')}</h3>
          <Button type="button" variant="outline" size="sm" onClick={addSection} className="rounded-full gap-1">
            <Plus className="h-3.5 w-3.5" /> {t('syllabus.sections.add')}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {sections.length === 0 ? (
            <div className="p-6 border-2 border-dashed border-border rounded-xl bg-muted/10 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('syllabus.sections.noSections')}</p>
              <Button type="button" variant="ghost" size="sm" onClick={addSection} className="mt-2 text-primary">
                <Plus className="h-3.5 w-3.5 me-1" /> {t('syllabus.wizard.addFirst')} {structureLabel.toLowerCase()}
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sections.map((section, index) => (
                <button
                  key={section.tempId}
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all group',
                    selectedIndex === index
                      ? 'bg-primary/10 border border-primary/30 text-primary'
                      : 'hover:bg-muted/50 border border-transparent text-foreground',
                    isRTL && 'text-right flex-row-reverse'
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-50" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block">
                      {section.title || `${structureLabel} ${index + 1}`}
                    </span>
                    {section.startDate && (
                      <span className="text-xs text-muted-foreground">{section.startDate}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(index, -1); }} disabled={index === 0} className="p-0.5 hover:text-primary disabled:opacity-30">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveSection(index, 1); }} disabled={index === sections.length - 1} className="p-0.5 hover:text-primary disabled:opacity-30">
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel — Section Form */}
      <div className={cn('flex-1 min-w-0', isRTL && 'order-1')}>
        {selected ? (
          <div className="space-y-6">
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="font-bold text-lg text-foreground">
                {selected.title || `${structureLabel} ${selectedIndex + 1}`}
              </h3>
              <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Button type="button" variant="ghost" size="sm" onClick={() => duplicateSection(selectedIndex)} className="text-muted-foreground hover:text-foreground rounded-full gap-1">
                  <Copy className="h-3.5 w-3.5" /> {t('syllabus.sections.duplicate')}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeSection(selectedIndex)} className="text-muted-foreground hover:text-destructive rounded-full gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> {t('syllabus.sections.delete')}
                </Button>
              </div>
            </div>

            <div className="space-y-5 p-5 rounded-xl border border-border bg-card shadow-sm">
              {/* Title */}
              <div className="space-y-2">
                <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" /> {t('syllabus.sections.sectionTitle')}
                </Label>
                <Input
                  value={selected.title}
                  onChange={(e) => updateSection(selectedIndex, { title: e.target.value })}
                  placeholder={`${structureLabel} ${selectedIndex + 1}`}
                  className="rounded-xl h-10"
                  autoDirection
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {t('syllabus.sections.description')}
                </Label>
                <Textarea
                  value={selected.description}
                  onChange={(e) => updateSection(selectedIndex, { description: e.target.value })}
                  placeholder={t('syllabus.sections.descriptionPlaceholder')}
                  rows={3}
                  className="rounded-xl resize-none text-sm"
                  autoDirection
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {t('syllabus.sections.startDate')}
                  </Label>
                  <Input
                    type="date"
                    value={selected.startDate}
                    onChange={(e) => updateSection(selectedIndex, { startDate: e.target.value })}
                    className="rounded-xl h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {t('syllabus.sections.endDate')}
                  </Label>
                  <Input
                    type="date"
                    value={selected.endDate}
                    onChange={(e) => updateSection(selectedIndex, { endDate: e.target.value })}
                    className="rounded-xl h-9"
                  />
                </div>
              </div>

              {/* Objectives */}
              <div className="space-y-3">
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                    <Target className="h-3.5 w-3.5 text-muted-foreground" /> {t('syllabus.sections.objectives')}
                  </Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addObjective} className="text-primary h-7 text-xs">
                    <Plus className="h-3 w-3 me-1" /> {t('syllabus.sections.add')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {selected.objectives.map((obj, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/30 flex-shrink-0" />
                      <Input
                        value={obj}
                        onChange={(e) => updateObjective(oi, e.target.value)}
                        placeholder={`${t('syllabus.sections.objectivePlaceholder')} ${oi + 1}`}
                        className="flex-1 rounded-lg h-8 text-sm"
                        autoDirection
                      />
                      {selected.objectives.length > 1 && (
                        <button type="button" onClick={() => removeObjective(oi)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Resources */}
              <div className="space-y-2">
                <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" /> {t('syllabus.sections.resources')}
                </Label>
                <Textarea
                  value={selected.resources}
                  onChange={(e) => updateSection(selectedIndex, { resources: e.target.value })}
                  placeholder={t('syllabus.sections.resourcesPlaceholder')}
                  rows={2}
                  className="rounded-xl resize-none text-sm"
                  autoDirection
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> {t('syllabus.sections.notes')}
                </Label>
                <Textarea
                  value={selected.notes}
                  onChange={(e) => updateSection(selectedIndex, { notes: e.target.value })}
                  placeholder={t('syllabus.sections.notesPlaceholder')}
                  rows={2}
                  className="rounded-xl resize-none text-sm"
                  autoDirection
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">{t('syllabus.wizard.buildOutline')}</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-6">
              {t('syllabus.wizard.buildOutlineDesc')}
            </p>
            <Button type="button" onClick={addSection} className="rounded-full gap-2">
              <Plus className="h-4 w-4" /> {t('syllabus.wizard.addFirst')} {structureLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
