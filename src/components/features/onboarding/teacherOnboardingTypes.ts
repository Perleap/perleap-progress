export type TeacherOnboardingFormData = {
  fullName: string;
  phoneNumber: string;
  subjects: string;
  yearsExperience: string;
  studentEducationLevel: string;
  teachingGoals: string;
  teachingStyle: string;
  teachingExample: string;
  additionalNotes: string;
};

export type TeacherOnboardingStepProps = {
  isRTL: boolean;
  formData: TeacherOnboardingFormData;
  onFormDataChange: (patch: Partial<TeacherOnboardingFormData>) => void;
};
