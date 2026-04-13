import type { TFunction } from 'i18next';

/** Map stored enum / slug values to the same labels used in onboarding & settings. */
export function displayPreferredLanguage(t: TFunction, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  if (raw === 'en') return t('auth.english');
  if (raw === 'he') return t('auth.hebrew');
  return raw;
}

export function displayLearningMethod(t: TFunction, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const keys: Record<string, string> = {
    visual: 'studentOnboarding.step1.visual',
    auditory: 'studentOnboarding.step1.auditory',
    kinesthetic: 'studentOnboarding.step1.kinesthetic',
    video: 'studentOnboarding.step1.video',
  };
  const path = keys[raw];
  return path ? t(path) : raw;
}

export function displaySoloVsGroup(t: TFunction, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const keys: Record<string, string> = {
    solo: 'studentOnboarding.step2.solo',
    group: 'studentOnboarding.step2.group',
    both: 'studentOnboarding.step2.both',
  };
  const path = keys[raw];
  return path ? t(path) : raw;
}

export function displayMotivationFactor(t: TFunction, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const keys: Record<string, string> = {
    curiosity: 'studentOnboarding.step3.curiosity',
    grades: 'studentOnboarding.step3.grades',
    encouragement: 'studentOnboarding.step3.encouragement',
    personal_goals: 'studentOnboarding.step3.personalGoals',
    competition: 'studentOnboarding.step3.competition',
  };
  const path = keys[raw];
  return path ? t(path) : raw;
}

export function displayHelpPreference(t: TFunction, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const keys: Record<string, string> = {
    hints: 'studentOnboarding.step4.hints',
    different_way: 'studentOnboarding.step4.differentWay',
    step_by_step: 'studentOnboarding.step4.stepByStep',
    more_time: 'studentOnboarding.step4.moreTime',
  };
  const path = keys[raw];
  return path ? t(path) : raw;
}

export function displayTeacherPreference(t: TFunction, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const keys: Record<string, string> = {
    patient: 'studentOnboarding.step4.patient',
    challenging: 'studentOnboarding.step4.challenging',
    clear: 'studentOnboarding.step4.clear',
    fun: 'studentOnboarding.step4.fun',
  };
  const path = keys[raw];
  return path ? t(path) : raw;
}

export function displayMentorTone(t: TFunction, raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const keys: Record<string, string> = {
    supportive: 'studentProfile.mentorToneValues.supportive',
    professional: 'studentProfile.mentorToneValues.professional',
    friendly: 'studentProfile.mentorToneValues.friendly',
    neutral: 'studentProfile.mentorToneValues.neutral',
  };
  const path = keys[raw];
  return path ? t(path) : raw.replace(/_/g, ' ');
}
