import { AssignmentCourseContextStep } from './AssignmentCourseContextStep';
import { AssignmentReleaseStep } from './AssignmentReleaseStep';
import type { SyllabusWithSections } from '@/types/syllabus';
import type { AssignmentWizardFormData } from '../assignmentWizardTypes';

interface AssignmentCourseReleaseStepProps {
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
  formData: AssignmentWizardFormData;
  onFormChange: (updater: (prev: AssignmentWizardFormData) => AssignmentWizardFormData) => void;
}

/** Combined "In your course" + "Release & AI" wizard step. */
export function AssignmentCourseReleaseStep({
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
  formData,
  onFormChange,
}: AssignmentCourseReleaseStepProps) {
  return (
    <div className="space-y-8">
      <AssignmentCourseContextStep
        syllabus={syllabus}
        syllabusLoading={syllabusLoading}
        syllabusSectionId={syllabusSectionId}
        onSyllabusSectionIdChange={onSyllabusSectionIdChange}
        gradingCategoryId={gradingCategoryId}
        onGradingCategoryIdChange={onGradingCategoryIdChange}
        linkedModuleActivityIds={linkedModuleActivityIds}
        onLinkedModuleActivityIdsChange={onLinkedModuleActivityIdsChange}
        isRTL={isRTL}
        lockSyllabusSection={lockSyllabusSection}
        loading={loading}
      />
      <AssignmentReleaseStep formData={formData} onFormChange={onFormChange} isRTL={isRTL} />
    </div>
  );
}
