import type { TFunction } from 'i18next';
import type { i18n as I18nInstance } from 'i18next';
import type { DbAssignmentType } from '@/types/models';

function resolveTypeKey(
  i18n: I18nInstance,
  assignmentType: DbAssignmentType,
  suffix: 'title' | 'body' | 'tutorial',
): string | null {
  const key = `assignmentTypeIntro.${assignmentType}.${suffix}`;
  return i18n.exists(key) ? key : null;
}

export function getAssignmentTypeIntroTitle(
  t: TFunction,
  i18n: I18nInstance,
  assignmentType: DbAssignmentType,
): string {
  const key = resolveTypeKey(i18n, assignmentType, 'title');
  return key ? t(key) : t('assignmentTypeIntro.fallback.title');
}

export function getAssignmentTypeIntroBody(
  t: TFunction,
  i18n: I18nInstance,
  assignmentType: DbAssignmentType,
): string {
  const key = resolveTypeKey(i18n, assignmentType, 'body');
  return key ? t(key) : t('assignmentTypeIntro.fallback.body');
}

export function getAssignmentTypeTutorial(
  t: TFunction,
  i18n: I18nInstance,
  assignmentType: DbAssignmentType,
): string {
  const key = resolveTypeKey(i18n, assignmentType, 'tutorial');
  return key ? t(key) : t('assignmentTypeIntro.fallback.tutorial');
}
