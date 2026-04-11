import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, Trash2, BookOpen, GraduationCap, Scale, FileWarning, MessageCircle } from 'lucide-react';
import type { WizardData, WizardGradingCategory } from '../CreateClassroomWizard';

interface SyllabusSetupStepProps {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  isRTL: boolean;
}

export const SyllabusSetupStep = ({ data, onChange, isRTL }: SyllabusSetupStepProps) => {
  const { t } = useTranslation();

  const structureOptions: { value: WizardData['structureType']; label: string; desc: string }[] = [
    { value: 'weeks', label: t('syllabus.weeks'), desc: t('syllabus.structureDesc.weeks') },
    { value: 'units', label: t('syllabus.units'), desc: t('syllabus.structureDesc.units') },
    { value: 'modules', label: t('syllabus.modules'), desc: t('syllabus.structureDesc.modules') },
  ];

  const addGradingCategory = () => {
    onChange({
      gradingCategories: [
        ...data.gradingCategories,
        { tempId: crypto.randomUUID(), name: '', weight: 0 },
      ],
    });
  };

  const removeGradingCategory = (tempId: string) => {
    onChange({ gradingCategories: data.gradingCategories.filter((c) => c.tempId !== tempId) });
  };

  const updateGradingCategory = (tempId: string, partial: Partial<WizardGradingCategory>) => {
    onChange({
      gradingCategories: data.gradingCategories.map((c) =>
        c.tempId === tempId ? { ...c, ...partial } : c
      ),
    });
  };

  const totalWeight = data.gradingCategories.reduce((sum, c) => sum + (c.weight || 0), 0);

  return (
    <div className="space-y-8">
      {/* Toggle */}
      <div className="p-6 rounded-xl border border-border shadow-sm">
        <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="p-3 bg-primary/10 rounded-xl">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
            <h3 className="font-bold text-lg text-foreground mb-1">{t('syllabus.wizard.createSyllabus')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('syllabus.wizard.createSyllabusDesc')}
            </p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={data.includeSyllabus ? 'default' : 'outline'}
                onClick={() => onChange({ includeSyllabus: true })}
                className="rounded-full"
                size="sm"
              >
                {t('syllabus.wizard.yesCreate')}
              </Button>
              <Button
                type="button"
                variant={!data.includeSyllabus ? 'default' : 'outline'}
                onClick={() => onChange({ includeSyllabus: false })}
                className="rounded-full"
                size="sm"
              >
                {t('syllabus.wizard.skipForNow')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {data.includeSyllabus && (
        <>
          {/* Syllabus Info */}
          <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
            <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
              <GraduationCap className="h-5 w-5" />
              <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('syllabus.wizard.syllabusDetails')}</h3>
            </div>

            <div className="space-y-2">
              <Label className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('syllabus.wizard.syllabusTitle')}
              </Label>
              <Input
                value={data.syllabusTitle}
                onChange={(e) => onChange({ syllabusTitle: e.target.value })}
                placeholder={data.courseTitle ? `${data.courseTitle} Syllabus` : 'e.g. Biology 101 - Spring 2026'}
                className="rounded-xl h-11"
                autoDirection
              />
            </div>

            <div className="space-y-2">
              <Label className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('syllabus.summary')}
              </Label>
              <Textarea
                value={data.syllabusSummary}
                onChange={(e) => onChange({ syllabusSummary: e.target.value })}
                placeholder="Brief summary of the course plan and expectations..."
                rows={3}
                className="rounded-xl resize-none"
                autoDirection
              />
            </div>

            {/* Structure Type */}
            <div className="space-y-3">
              <Label className={`text-body font-medium block ${isRTL ? 'text-right' : 'text-left'}`}>
                {t('syllabus.structureType')}
              </Label>
              <div className="grid grid-cols-3 gap-3">
                {structureOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ structureType: opt.value })}
                    className={cn(
                      'p-4 rounded-xl border-2 text-left transition-all',
                      data.structureType === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 bg-card',
                      isRTL && 'text-right'
                    )}
                  >
                    <span className="font-bold text-foreground">{opt.label}</span>
                    <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Policies */}
          <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
            <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Scale className="h-5 w-5" />
              <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('syllabus.wizard.policies')}</h3>
            </div>
            <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('syllabus.wizard.policiesOptional')}
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('syllabus.wizard.gradingPolicy')}
                </Label>
                <Textarea
                  value={data.gradingPolicyText}
                  onChange={(e) => onChange({ gradingPolicyText: e.target.value })}
                  placeholder={t('syllabus.wizard.gradingPolicyPlaceholder')}
                  rows={3}
                  className="rounded-xl resize-none text-sm"
                  autoDirection
                />
              </div>

              <div className="space-y-2">
                <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <FileWarning className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('syllabus.wizard.lateWorkPolicy')}
                </Label>
                <Textarea
                  value={data.lateWorkPolicyText}
                  onChange={(e) => onChange({ lateWorkPolicyText: e.target.value })}
                  placeholder={t('syllabus.wizard.lateWorkPolicyPlaceholder')}
                  rows={3}
                  className="rounded-xl resize-none text-sm"
                  autoDirection
                />
              </div>

              <div className="space-y-2">
                <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('syllabus.wizard.attendancePolicy')}
                </Label>
                <Textarea
                  value={data.attendancePolicyText}
                  onChange={(e) => onChange({ attendancePolicyText: e.target.value })}
                  placeholder={t('syllabus.wizard.attendancePolicyPlaceholder')}
                  rows={3}
                  className="rounded-xl resize-none text-sm"
                  autoDirection
                />
              </div>

              <div className="space-y-2">
                <Label className={`text-sm font-medium flex items-center gap-1.5 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('syllabus.wizard.communicationPolicy')}
                </Label>
                <Textarea
                  value={data.communicationPolicyText}
                  onChange={(e) => onChange({ communicationPolicyText: e.target.value })}
                  placeholder={t('syllabus.wizard.communicationPolicyPlaceholder')}
                  rows={3}
                  className="rounded-xl resize-none text-sm"
                  autoDirection
                />
              </div>
            </div>
          </div>

          {/* Grading Categories */}
          <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Scale className="h-5 w-5" />
                <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('syllabus.wizard.gradingCategories')}</h3>
              </div>
              <Button type="button" variant="outline" onClick={addGradingCategory} className="rounded-full" size="sm">
                <Plus className="h-4 w-4 me-1" /> {t('syllabus.wizard.addCategory')}
              </Button>
            </div>
            <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('syllabus.wizard.gradingCategoriesOptional')}
            </p>

            {data.gradingCategories.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-border rounded-xl bg-muted/10 text-center">
                <p className="text-subtle text-sm">{t('syllabus.wizard.noGradingCategories')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.gradingCategories.map((cat) => (
                  <div key={cat.tempId} className="flex items-center gap-3 p-3 border border-border rounded-xl bg-card">
                    <Input
                      value={cat.name}
                      onChange={(e) => updateGradingCategory(cat.tempId, { name: e.target.value })}
                      placeholder={t('syllabus.grading.namePlaceholder')}
                      className="flex-1 rounded-lg h-9"
                      autoDirection
                    />
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={cat.weight || ''}
                        onChange={(e) => updateGradingCategory(cat.tempId, { weight: Number(e.target.value) || 0 })}
                        className="w-20 rounded-lg h-9 text-center"
                        placeholder="0"
                      />
                      <span className="text-sm text-muted-foreground font-medium">%</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeGradingCategory(cat.tempId)} className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-full">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className={`flex items-center gap-2 px-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-sm font-medium text-muted-foreground">Total:</span>
                  <span className={cn('text-sm font-bold', totalWeight === 100 ? 'text-green-600' : totalWeight > 100 ? 'text-destructive' : 'text-foreground')}>
                    {totalWeight}%
                  </span>
                  {totalWeight !== 100 && totalWeight > 0 && (
                    <span className="text-xs text-muted-foreground">(should equal 100%)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
