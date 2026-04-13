import type { SyllabusSection, ReleaseMode, StudentProgressStatus } from '@/types/syllabus';

export function isSectionUnlocked(
  section: SyllabusSection,
  allSections: SyllabusSection[],
  releaseMode: ReleaseMode,
  studentProgressMap: Record<string, StudentProgressStatus>,
): boolean {
  switch (releaseMode) {
    case 'all_at_once':
      return true;

    case 'sequential': {
      if (section.order_index === 0) return true;
      const prev = allSections.find((s) => s.order_index === section.order_index - 1);
      if (!prev) return true;
      return studentProgressMap[prev.id] === 'completed';
    }

    case 'date_based': {
      if (!section.start_date) return true;
      return new Date(section.start_date) <= new Date();
    }

    case 'manual':
      return !section.is_locked;

    case 'prerequisites': {
      const prereqs = section.prerequisites ?? [];
      if (prereqs.length === 0) return true;
      return prereqs.every((id) => studentProgressMap[id] === 'completed');
    }

    default:
      return true;
  }
}
