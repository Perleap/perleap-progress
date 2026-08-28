import type { TFunction } from 'i18next';

export type ClassroomViewMode = 'grid' | 'list' | 'compact' | 'detailed' | 'table' | 'timeline';

export function formatClassroomDate(
  dateString: string | null | undefined,
  options?: { format?: 'short' | 'long'; unavailable?: string },
): string {
  const format = options?.format ?? 'short';
  const unavailable = options?.unavailable ?? 'N/A';
  if (!dateString) return unavailable;
  const date = new Date(dateString);
  if (format === 'short') {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getClassroomViewModeLabel(mode: ClassroomViewMode, t: TFunction): string {
  return t(`classroomList.viewModes.${mode}`);
}
