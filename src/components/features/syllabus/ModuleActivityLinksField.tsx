import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { SectionResource, SyllabusWithSections } from '@/types/syllabus';

export interface ModuleActivityLinksFieldProps {
  syllabus: SyllabusWithSections | null | undefined;
  syllabusSectionId: string;
  /** Selected section_resource ids in syllabus order */
  value: string[];
  onChange: (orderedIds: string[]) => void;
  isRTL?: boolean;
  disabled?: boolean;
}

/**
 * Multi-select module activities to link to an assignment (AI + pedagogy).
 * Parent resets `value` when the syllabus module changes.
 */
export function ModuleActivityLinksField({
  syllabus,
  syllabusSectionId,
  value,
  onChange,
  isRTL,
  disabled,
}: ModuleActivityLinksFieldProps) {
  const { t } = useTranslation();

  const resources = useMemo((): SectionResource[] => {
    if (!syllabusSectionId || !syllabus?.section_resources) return [];
    return syllabus.section_resources[syllabusSectionId] ?? [];
  }, [syllabus, syllabusSectionId]);

  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (id: string, checked: boolean) => {
    const order = resources.map((r) => r.id);
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(order.filter((rid) => next.has(rid)));
  };

  if (!syllabusSectionId || resources.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-muted/20 p-3 space-y-2',
        isRTL && 'text-right',
      )}
    >
      <Label className={cn('text-xs font-semibold text-foreground', isRTL && 'text-right')}>
        {t('syllabus.moduleActivities.linkForAssignment', 'Module activities for AI context')}
      </Label>
      <p className="text-[11px] text-muted-foreground leading-snug">
        {t(
          'syllabus.moduleActivities.linkHelper',
          'Selected activities are included when the AI helps students with this assignment. Defaults to all activities in this module.',
        )}
      </p>
      <ul className="space-y-2 pt-1">
        {resources.map((r) => (
          <li key={r.id} className={cn('flex items-start gap-2', isRTL && 'flex-row-reverse')}>
            <Checkbox
              id={`ma-${r.id}`}
              checked={selected.has(r.id)}
              onCheckedChange={(c) => toggle(r.id, c === true)}
              disabled={disabled}
              className="mt-0.5"
            />
            <label
              htmlFor={`ma-${r.id}`}
              className="text-sm leading-snug cursor-pointer flex-1 min-w-0"
            >
              {r.title}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
