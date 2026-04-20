import type { SyllabusSection, ReleaseMode, StudentProgressStatus } from '@/types/syllabus';

/** Course order: `order_index` then stable `id` so ties are not non-deterministic across renders. */
export function sectionsInCourseOrder(sections: SyllabusSection[]): SyllabusSection[] {
  return [...sections].sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));
}

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
      const ordered = sectionsInCourseOrder(allSections);
      const idx = ordered.findIndex((s) => s.id === section.id);
      if (idx < 0) return false;
      if (idx === 0) return true;
      for (let j = 0; j < idx; j++) {
        if (studentProgressMap[ordered[j].id] !== 'completed') return false;
      }
      return true;
    }

    case 'date_based': {
      if (!section.start_date) return true;
      return new Date(section.start_date) <= new Date();
    }

    case 'manual':
      return !section.is_locked;

    default:
      return true;
  }
}
