export type StudentOnboardingFormData = {
  fullName: string;
  learningMethods: string;
  soloVsGroup: string;
  scheduledVsFlexible: string;
  motivationFactors: string;
  helpPreferences: string;
  teacherPreferences: string;
  feedbackPreferences: string;
  learningGoal: string;
  specialNeeds: string;
  additionalNotes: string;
};

export type StudentOnboardingStepProps = {
  isRTL: boolean;
  formData: StudentOnboardingFormData;
  onFormDataChange: (patch: Partial<StudentOnboardingFormData>) => void;
};
