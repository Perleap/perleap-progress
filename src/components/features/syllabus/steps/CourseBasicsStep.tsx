import type { WizardData } from '../CreateClassroomWizard';
import {
  ClassroomBasicInfoSection,
  ClassroomOutcomesSection,
  ClassroomSubjectAreasSection,
} from '@/components/features/classroom/forms/sections';

interface CourseBasicsStepProps {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export const CourseBasicsStep = ({ data, onChange }: CourseBasicsStepProps) => {
  return (
    <div className="space-y-8">
      <ClassroomBasicInfoSection
        formData={data}
        onFormChange={onChange}
        descriptionFieldKey="course-basics-description"
      />
      <ClassroomSubjectAreasSection formData={data} onFormChange={onChange} />
      <ClassroomOutcomesSection formData={data} onFormChange={onChange} />
    </div>
  );
};
