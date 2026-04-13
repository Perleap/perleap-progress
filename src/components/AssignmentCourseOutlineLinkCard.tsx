import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SyllabusWithSections } from '@/types/syllabus';

export interface AssignmentCourseOutlineLinkCardProps {
  isRTL: boolean;
  syllabus: SyllabusWithSections | null | undefined;
  syllabusLoading?: boolean;
  syllabusSectionId: string;
  onSyllabusSectionIdChange: (id: string) => void;
  gradingCategoryId: string;
  onGradingCategoryIdChange: (id: string) => void;
  /** `card`: bordered block + course outline title. `inline`: fields only for nested layout. */
  variant?: 'card' | 'inline';
  /** Merged onto the outer wrapper when `variant` is `inline`. */
  className?: string;
}

export function AssignmentCourseOutlineLinkCard({
  isRTL,
  syllabus,
  syllabusLoading,
  syllabusSectionId,
  onSyllabusSectionIdChange,
  gradingCategoryId,
  onGradingCategoryIdChange,
  variant = 'card',
  className,
}: AssignmentCourseOutlineLinkCardProps) {
  const { t } = useTranslation();
  const hasSyllabus = !!syllabus;
  const hasSections = (syllabus?.sections?.length ?? 0) > 0;
  const hasCategories = (syllabus?.grading_categories?.length ?? 0) > 0;
  const hasLinkTargets = hasSections || hasCategories;

  const sectionDisplayLabel =
    !syllabusSectionId
      ? t('common.none', 'None')
      : syllabus?.sections.find((s) => s.id === syllabusSectionId)?.title ?? syllabusSectionId;

  const categoryDisplayLabel =
    !gradingCategoryId
      ? t('common.none', 'None')
      : (() => {
          const c = syllabus?.grading_categories.find((x) => x.id === gradingCategoryId);
          return c ? `${c.name} (${c.weight}%)` : gradingCategoryId;
        })();

  const sectionLabel =
    variant === 'inline'
      ? t('createAssignment.metadata.linkedModule')
      : t('createAssignment.syllabusModelLabel');

  const triggerClass = cn(
    'w-full min-w-0',
    variant === 'inline'
      ? 'h-9 rounded-lg text-sm'
      : 'h-11 rounded-xl',
    isRTL ? 'text-right' : 'text-left',
  );

  const body = (
    <>
      {syllabusLoading ? (
        <p className={cn('text-sm text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>
          {t('createAssignment.courseOutlineLoading')}
        </p>
      ) : !hasSyllabus ? (
        <p className={cn('text-sm text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>
          {t('createAssignment.courseOutlineNoSyllabus')}
        </p>
      ) : !hasLinkTargets ? (
        <p className={cn('text-sm text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>
          {t('createAssignment.courseOutlineNoSections')}
        </p>
      ) : (
        <div
          className={cn(
            'grid grid-cols-1',
            variant === 'inline'
              ? 'w-fit max-w-full gap-x-2 gap-y-2 md:grid-cols-2 md:gap-x-2 md:[grid-template-columns:minmax(0,12rem)_minmax(0,12rem)]'
              : 'w-full gap-x-6 gap-y-4 md:grid-cols-2',
          )}
        >
          {hasSections && (
            <div
              className={cn(
                'space-y-1.5',
                hasCategories ? '' : 'md:col-span-2',
                variant === 'inline' && !hasCategories && 'max-w-[12rem]',
              )}
            >
              <Label className={cn('text-body font-medium block', isRTL ? 'text-right' : 'text-left')}>
                {sectionLabel}
              </Label>
              <Select
                value={syllabusSectionId || '_none'}
                onValueChange={(v) => onSyllabusSectionIdChange(v === '_none' ? '' : v)}
              >
                <SelectTrigger className={triggerClass} dir={isRTL ? 'rtl' : 'ltr'}>
                  <SelectValue placeholder={t('createAssignment.linkToSyllabusModel')}>
                    {sectionDisplayLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                  <SelectItem value="_none">{t('common.none', 'None')}</SelectItem>
                  {syllabus!.sections.map((s) => (
                    <SelectItem key={s.id} value={s.id} className={isRTL ? 'text-right' : 'text-left'}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {hasCategories && (
            <div
              className={cn(
                'space-y-1.5',
                hasSections ? '' : 'md:col-span-2',
                variant === 'inline' && !hasSections && 'max-w-[12rem]',
              )}
            >
              <Label className={cn('text-body font-medium block', isRTL ? 'text-right' : 'text-left')}>
                {t('syllabus.gradingCategory')}
              </Label>
              <Select
                value={gradingCategoryId || '_none'}
                onValueChange={(v) => onGradingCategoryIdChange(v === '_none' ? '' : v)}
              >
                <SelectTrigger className={triggerClass} dir={isRTL ? 'rtl' : 'ltr'}>
                  <SelectValue placeholder={t('syllabus.selectCategory')}>{categoryDisplayLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl" dir={isRTL ? 'rtl' : 'ltr'}>
                  <SelectItem value="_none">{t('common.none', 'None')}</SelectItem>
                  {syllabus!.grading_categories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className={isRTL ? 'text-right' : 'text-left'}>
                      {c.name} ({c.weight}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (variant === 'inline') {
    return <div className={cn('w-fit max-w-full space-y-2', className)}>{body}</div>;
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-6 shadow-sm">
      <div className={cn('flex items-center gap-2 text-primary', isRTL && 'flex-row-reverse')}>
        <Layers className="h-5 w-5 shrink-0" />
        <h3 className={cn('font-bold text-heading', isRTL ? 'text-right' : 'text-left')}>
          {t('createAssignment.courseOutlineLinkTitle')}
        </h3>
      </div>
      {body}
    </div>
  );
}
