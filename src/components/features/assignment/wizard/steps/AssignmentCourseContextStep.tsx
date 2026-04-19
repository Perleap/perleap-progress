import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SyllabusWithSections } from '@/types/syllabus';
import { AssignmentCourseOutlineLinkCard } from '@/components/AssignmentCourseOutlineLinkCard';
import { ModuleActivityLinksField } from '@/components/features/syllabus/ModuleActivityLinksField';

interface AssignmentCourseContextStepProps {
  syllabus: SyllabusWithSections | null | undefined;
  syllabusLoading: boolean;
  syllabusSectionId: string;
  onSyllabusSectionIdChange: (id: string) => void;
  gradingCategoryId: string;
  onGradingCategoryIdChange: (id: string) => void;
  linkedModuleActivityIds: string[];
  onLinkedModuleActivityIdsChange: (ids: string[]) => void;
  isRTL: boolean;
  lockSyllabusSection?: boolean;
  loading: boolean;
}

export function AssignmentCourseContextStep({
  syllabus,
  syllabusLoading,
  syllabusSectionId,
  onSyllabusSectionIdChange,
  gradingCategoryId,
  onGradingCategoryIdChange,
  linkedModuleActivityIds,
  onLinkedModuleActivityIdsChange,
  isRTL,
  lockSyllabusSection = false,
  loading,
}: AssignmentCourseContextStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-6 rounded-xl border border-border shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="space-y-1 pt-0.5">
        <AssignmentCourseOutlineLinkCard
          variant="inline"
          className="max-w-[min(100%,25rem)]"
          isRTL={isRTL}
          syllabus={syllabus}
          syllabusLoading={syllabusLoading}
          lockSyllabusSection={lockSyllabusSection}
          syllabusSectionId={syllabusSectionId}
          onSyllabusSectionIdChange={onSyllabusSectionIdChange}
          gradingCategoryId={gradingCategoryId}
          onGradingCategoryIdChange={onGradingCategoryIdChange}
        />
        <ModuleActivityLinksField
          syllabus={syllabus ?? undefined}
          syllabusSectionId={syllabusSectionId}
          value={linkedModuleActivityIds}
          onChange={onLinkedModuleActivityIdsChange}
          isRTL={isRTL}
          disabled={loading}
        />
        {(syllabus?.sections?.length ?? 0) > 0 ? (
          <p
            className={cn(
              'text-muted-foreground text-xs leading-relaxed',
              isRTL ? 'text-right' : 'text-left',
            )}
          >
            {t('createAssignment.metadata.linkedModuleHelper')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
