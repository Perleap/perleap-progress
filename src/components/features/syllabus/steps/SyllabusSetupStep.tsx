import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  BookOpen,
  GraduationCap,
  Scale,
  FileWarning,
  MessageCircle,
  Shield,
  Users,
  Award,
  PenLine,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import type { WizardData, WizardGradingCategory } from '../CreateClassroomWizard';
import type { SyllabusPolicyType, SyllabusPolicy } from '@/types/syllabus';
import { ReleaseModeSelect } from '../ReleaseModeSelect';

interface SyllabusSetupStepProps {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  isRTL: boolean;
}

const PRESET_POLICIES: {
  type: SyllabusPolicyType;
  labelKey: string;
  fallbackLabel: string;
  icon: typeof GraduationCap;
  colorClass: string;
}[] = [
  { type: 'grading', labelKey: 'syllabus.policies.grading', fallbackLabel: 'Grading Policy', icon: GraduationCap, colorClass: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30' },
  { type: 'attendance', labelKey: 'syllabus.policies.attendance', fallbackLabel: 'Attendance Policy', icon: BookOpen, colorClass: 'text-green-500 bg-green-100 dark:bg-green-900/30' },
  { type: 'late_work', labelKey: 'syllabus.policies.lateWork', fallbackLabel: 'Late Work Policy', icon: FileWarning, colorClass: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30' },
  { type: 'communication', labelKey: 'syllabus.policies.communication', fallbackLabel: 'Communication Policy', icon: MessageCircle, colorClass: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30' },
  { type: 'academic_integrity', labelKey: 'syllabus.policies.academicIntegrity', fallbackLabel: 'Academic Integrity', icon: Shield, colorClass: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
  { type: 'participation', labelKey: 'syllabus.policies.participation', fallbackLabel: 'Participation', icon: Users, colorClass: 'text-teal-500 bg-teal-100 dark:bg-teal-900/30' },
  { type: 'extra_credit', labelKey: 'syllabus.policies.extraCredit', fallbackLabel: 'Extra Credit', icon: Award, colorClass: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30' },
];

export function getPolicyIcon(type: SyllabusPolicyType) {
  const preset = PRESET_POLICIES.find((p) => p.type === type);
  return preset?.icon ?? PenLine;
}

export function getPolicyColor(type: SyllabusPolicyType) {
  const preset = PRESET_POLICIES.find((p) => p.type === type);
  return preset?.colorClass ?? 'text-gray-500 bg-gray-100 dark:bg-gray-900/30';
}

export const SyllabusSetupStep = ({ data, onChange, isRTL }: SyllabusSetupStepProps) => {
  const { t } = useTranslation();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());

  const structureOptions: { value: WizardData['structureType']; label: string; desc: string }[] = [
    { value: 'weeks', label: t('syllabus.weeks'), desc: t('syllabus.structureDesc.weeks') },
    { value: 'units', label: t('syllabus.units'), desc: t('syllabus.structureDesc.units') },
    { value: 'modules', label: t('syllabus.modules'), desc: t('syllabus.structureDesc.modules') },
  ];

  const addedTypes = new Set(data.policies.map((p) => p.type));

  const addPolicy = (type: SyllabusPolicyType, label: string) => {
    const newPolicy: SyllabusPolicy = {
      id: crypto.randomUUID(),
      type,
      label,
      content: '',
      order_index: data.policies.length,
    };
    onChange({ policies: [...data.policies, newPolicy] });
    setExpandedPolicies((prev) => new Set([...prev, newPolicy.id]));
    setPopoverOpen(false);
  };

  const addCustomPolicy = () => {
    addPolicy('custom', t('syllabus.policies.customPolicy', 'Custom Policy'));
  };

  const removePolicy = (id: string) => {
    onChange({
      policies: data.policies.filter((p) => p.id !== id).map((p, i) => ({ ...p, order_index: i })),
    });
  };

  const updatePolicy = (id: string, partial: Partial<SyllabusPolicy>) => {
    onChange({
      policies: data.policies.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Grading categories helpers (nested under grading policy) ---
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

  const hasGradingPolicy = data.policies.some((p) => p.type === 'grading');

  return (
    <div className="space-y-8">
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

            <ReleaseModeSelect
              label={t('syllabus.releaseMode.label', 'Release mode')}
              value={data.release_mode}
              isRTL={isRTL}
              onChange={(release_mode) => {
                let sections = data.sections;
                if (release_mode !== 'prerequisites') {
                  sections = sections.map((s) => ({ ...s, prerequisites: [] }));
                }
                if (release_mode !== 'manual') {
                  sections = sections.map((s) => ({ ...s, is_locked: false }));
                }
                onChange({ release_mode, sections });
              }}
            />
          </div>

          {/* Policies - Dynamic */}
          <div className="space-y-6 p-6 rounded-xl border border-border shadow-sm">
            <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2 text-primary ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Scale className="h-5 w-5" />
                <h3 className={`font-bold text-heading ${isRTL ? 'text-right' : 'text-left'}`}>{t('syllabus.wizard.policies')}</h3>
              </div>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger className="inline-flex items-center justify-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground cursor-pointer">
                  <Plus className="h-4 w-4" /> {t('syllabus.policies.addPolicy', 'Add Policy')}
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2 rounded-xl" sideOffset={8}>
                  <div className="space-y-0.5">
                    {PRESET_POLICIES.map((preset) => {
                      const Icon = preset.icon;
                      const alreadyAdded = addedTypes.has(preset.type);
                      return (
                        <button
                          key={preset.type}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => addPolicy(preset.type, t(preset.labelKey, preset.fallbackLabel))}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                            alreadyAdded
                              ? 'opacity-50 cursor-not-allowed'
                              : 'hover:bg-muted/60 cursor-pointer',
                            isRTL && 'flex-row-reverse text-right'
                          )}
                        >
                          <div className={cn('p-1.5 rounded-lg', preset.colorClass)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="flex-1 font-medium text-foreground">
                            {t(preset.labelKey, preset.fallbackLabel)}
                          </span>
                          {alreadyAdded && <Check className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      );
                    })}
                    <div className="border-t border-border my-1" />
                    <button
                      type="button"
                      onClick={addCustomPolicy}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted/60 transition-all',
                        isRTL && 'flex-row-reverse text-right'
                      )}
                    >
                      <div className="p-1.5 rounded-lg text-gray-500 bg-gray-100 dark:bg-gray-900/30">
                        <PenLine className="h-3.5 w-3.5" />
                      </div>
                      <span className="flex-1 font-medium text-foreground">
                        {t('syllabus.policies.customPolicy', 'Custom Policy')}
                      </span>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <p className={`text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('syllabus.policies.addPolicyDesc', 'Add only the policies relevant to your course. You can always add more later.')}
            </p>

            {data.policies.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-border rounded-xl bg-muted/10 text-center">
                <Scale className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-subtle text-sm">{t('syllabus.policies.noPolicies', 'No policies added yet. Click "Add Policy" to get started.')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.policies.map((policy) => {
                  const Icon = getPolicyIcon(policy.type);
                  const colorClass = getPolicyColor(policy.type);
                  const isExpanded = expandedPolicies.has(policy.id);
                  const isGrading = policy.type === 'grading';
                  const isCustom = policy.type === 'custom';

                  return (
                    <div key={policy.id} className="border border-border rounded-xl bg-card overflow-hidden">
                      {/* Policy header */}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(policy.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-muted/30',
                          isRTL && 'flex-row-reverse'
                        )}
                      >
                        <div className={cn('p-1.5 rounded-lg', colorClass)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className={cn('flex-1 font-medium text-sm text-foreground', isRTL ? 'text-right' : 'text-left')}>
                          {policy.label}
                        </span>
                        {policy.content && (
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted/50 rounded-full">
                            {t('syllabus.policies.filled', 'Filled')}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                          {isCustom && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">{t('syllabus.policies.policyName', 'Policy Name')}</Label>
                              <Input
                                value={policy.label}
                                onChange={(e) => updatePolicy(policy.id, { label: e.target.value })}
                                className="rounded-lg h-9"
                                autoDirection
                              />
                            </div>
                          )}
                          <Textarea
                            value={policy.content}
                            onChange={(e) => updatePolicy(policy.id, { content: e.target.value })}
                            placeholder={t('syllabus.policies.contentPlaceholder', 'Describe this policy...')}
                            rows={3}
                            className="rounded-lg resize-none text-sm"
                            autoDirection
                          />

                          {/* Grading categories nested inside grading policy */}
                          {isGrading && (
                            <div className="mt-3 p-3 rounded-lg border border-border bg-muted/10 space-y-3">
                              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                  {t('syllabus.wizard.gradingCategories')}
                                </Label>
                                <Button type="button" variant="ghost" size="sm" onClick={addGradingCategory} className="rounded-full gap-1 h-7 text-xs">
                                  <Plus className="h-3 w-3" /> {t('syllabus.wizard.addCategory')}
                                </Button>
                              </div>
                              {data.gradingCategories.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                  {t('syllabus.wizard.noGradingCategories')}
                                </p>
                              ) : (
                                <>
                                  {data.gradingCategories.map((cat) => (
                                    <div key={cat.tempId} className="flex items-center gap-3 p-2.5 border border-border rounded-lg bg-card">
                                      <Input
                                        value={cat.name}
                                        onChange={(e) => updateGradingCategory(cat.tempId, { name: e.target.value })}
                                        placeholder={t('syllabus.grading.namePlaceholder')}
                                        className="flex-1 rounded-lg h-8 text-sm"
                                        autoDirection
                                      />
                                      <div className="flex items-center gap-1.5">
                                        <Input
                                          type="number"
                                          min={0}
                                          max={100}
                                          value={cat.weight || ''}
                                          onChange={(e) => updateGradingCategory(cat.tempId, { weight: Number(e.target.value) || 0 })}
                                          className="w-20 rounded-lg h-8 text-center text-sm"
                                          placeholder="0"
                                        />
                                        <span className="text-sm text-muted-foreground font-medium">%</span>
                                      </div>
                                      <Button type="button" variant="ghost" size="icon" onClick={() => removeGradingCategory(cat.tempId)} className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-full">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                  <div className={`flex items-center gap-2 px-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-xs font-medium text-muted-foreground">Total:</span>
                                    <span className={cn('text-xs font-bold', totalWeight === 100 ? 'text-green-600' : totalWeight > 100 ? 'text-destructive' : 'text-foreground')}>
                                      {totalWeight}%
                                    </span>
                                    {totalWeight !== 100 && totalWeight > 0 && (
                                      <span className="text-[10px] text-muted-foreground">(should equal 100%)</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          <div className={`flex justify-end ${isRTL ? 'justify-start' : ''}`}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePolicy(policy.id)}
                              className="rounded-full text-muted-foreground hover:text-destructive gap-1 h-7 text-xs"
                            >
                              <Trash2 className="h-3 w-3" /> {t('syllabus.policies.remove', 'Remove')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Show grading categories standalone reminder if no grading policy */}
            {!hasGradingPolicy && data.gradingCategories.length > 0 && (
              <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900/30 dark:bg-orange-900/10">
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  {t('syllabus.policies.gradingCategoriesOrphan', 'You have grading categories defined but no Grading Policy. Add a Grading Policy to manage them, or they will be saved independently.')}
                </p>
              </div>
            )}
          </div>
    </div>
  );
};
