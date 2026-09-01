export {
  buildClassroomUpdatePayload,
  buildEditClassroomFormData,
  type ClassroomFormData,
  type EditClassroomFormData,
  type EditClassroomRecord,
} from '@/components/features/classroom/forms/classroomFormTypes';

export {
  ClassroomBasicInfoSection,
  ClassroomMaterialsSection,
  ClassroomOutcomesSection,
  ClassroomSubjectAreasSection,
} from '@/components/features/classroom/forms/sections';

/** @deprecated Use ClassroomBasicInfoSection */
export { ClassroomBasicInfoSection as EditClassroomBasicInfoSection } from '@/components/features/classroom/forms/sections/ClassroomBasicInfoSection';
/** @deprecated Use ClassroomSubjectAreasSection */
export { ClassroomSubjectAreasSection as EditClassroomSubjectAreasSection } from '@/components/features/classroom/forms/sections/ClassroomSubjectAreasSection';
/** @deprecated Use ClassroomMaterialsSection */
export { ClassroomMaterialsSection as EditClassroomMaterialsSection } from '@/components/features/classroom/forms/sections/ClassroomMaterialsSection';
/** @deprecated Use ClassroomOutcomesSection */
export { ClassroomOutcomesSection as EditClassroomOutcomesSection } from '@/components/features/classroom/forms/sections/ClassroomOutcomesSection';
