import { supabase } from '@/integrations/supabase/client';
import type { StudentOnboardingFormData, TeacherOnboardingFormData } from '@/components/features/onboarding';

export async function cleanupOrphanedProfilesByEmail(email: string): Promise<void> {
  await supabase.rpc('cleanup_orphaned_profiles_by_email', { p_email: email });
}

export async function uploadOnboardingAvatar(
  userId: string,
  file: File,
  bucket: 'student-avatars' | 'teacher-avatars',
): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage.from(bucket).upload(fileName, file);
  return error ? null : fileName;
}

export function buildStudentOnboardingProfile(
  userId: string,
  email: string | undefined,
  formData: StudentOnboardingFormData,
  language: string,
  avatarPath: string | null,
) {
  return {
    user_id: userId,
    email,
    full_name: formData.fullName,
    avatar_url: avatarPath,
    learning_methods: formData.learningMethods,
    solo_vs_group: formData.soloVsGroup,
    scheduled_vs_flexible: formData.scheduledVsFlexible,
    motivation_factors: formData.motivationFactors,
    help_preferences: formData.helpPreferences,
    teacher_preferences: formData.teacherPreferences,
    feedback_preferences: formData.feedbackPreferences,
    learning_goal: formData.learningGoal,
    special_needs: formData.specialNeeds,
    additional_notes: formData.additionalNotes,
    preferences_quiz: {
      learningMethods: formData.learningMethods,
      soloVsGroup: formData.soloVsGroup,
      scheduledVsFlexible: formData.scheduledVsFlexible,
      motivationFactors: formData.motivationFactors,
    },
    mentor_tone_ref: 'supportive',
    preferred_language: language || 'en',
  };
}

export async function insertStudentOnboardingProfile(
  userId: string,
  email: string | undefined,
  formData: StudentOnboardingFormData,
  language: string,
  avatarPath: string | null,
) {
  const profileData = buildStudentOnboardingProfile(userId, email, formData, language, avatarPath);
  return supabase.from('student_profiles').insert(profileData).select();
}

export function buildTeacherOnboardingProfile(
  userId: string,
  email: string | undefined,
  formData: TeacherOnboardingFormData,
  language: string,
  avatarPath: string | null,
) {
  return {
    user_id: userId,
    email,
    full_name: formData.fullName,
    avatar_url: avatarPath,
    phone_number: formData.phoneNumber,
    subjects: formData.subjects.split(',').map((s) => s.trim()),
    years_experience: parseInt(formData.yearsExperience) || 0,
    student_education_level: formData.studentEducationLevel,
    teaching_goals: formData.teachingGoals,
    style_notes: formData.teachingStyle,
    teaching_examples: formData.teachingExample,
    sample_explanation: formData.additionalNotes,
    preferred_language: language || 'en',
  };
}

export async function insertTeacherOnboardingProfile(
  userId: string,
  email: string | undefined,
  formData: TeacherOnboardingFormData,
  language: string,
  avatarPath: string | null,
) {
  const profileData = buildTeacherOnboardingProfile(userId, email, formData, language, avatarPath);
  return supabase.from('teacher_profiles').insert(profileData).select();
}
