import type { i18n as I18nInstance, TFunction } from 'i18next';
import type { DbAssignmentType } from '@/types/models';

export type AssignmentTypeIntroContent = {
  title: string;
  body: string;
  tutorial: string;
};

export function getAssignmentTypeIntroContent(
  assignmentType: DbAssignmentType,
  t: TFunction,
  i18n: I18nInstance,
): AssignmentTypeIntroContent {
  const titleKey = `assignmentTypeIntro.${assignmentType}.title`;
  const bodyKey = `assignmentTypeIntro.${assignmentType}.body`;
  const tutorialKey = `assignmentTypeIntro.${assignmentType}.tutorial`;

  return {
    title: i18n.exists(titleKey) ? t(titleKey) : t('assignmentTypeIntro.fallback.title'),
    body: i18n.exists(bodyKey) ? t(bodyKey) : t('assignmentTypeIntro.fallback.body'),
    tutorial: i18n.exists(tutorialKey)
      ? t(tutorialKey)
      : t('assignmentTypeIntro.fallback.tutorial'),
  };
}
