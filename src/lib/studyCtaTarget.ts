import type { ReleaseMode, StudentProgressStatus, SyllabusSection } from '@/types/syllabus';
import { isSectionUnlocked } from '@/lib/sectionUnlock';

export type StudyCtaVariant = 'continue' | 'start' | 'review';

export function getStudyCtaTarget(
  sections: SyllabusSection[],
  releaseMode: ReleaseMode,
  studentProgressMap: Record<string, StudentProgressStatus>,
): { targetSectionId: string | null; variant: StudyCtaVariant } {
  const sorted = [...sections].sort((a, b) => a.order_index - b.order_index);
  if (sorted.length === 0) {
    return { targetSectionId: null, variant: 'start' };
  }

  for (const s of sorted) {
    const p = studentProgressMap[s.id];
    if (p === 'in_progress' || p === 'reviewed') {
      return { targetSectionId: s.id, variant: 'continue' };
    }
  }

  for (const s of sorted) {
    if (!isSectionUnlocked(s, sections, releaseMode, studentProgressMap)) continue;
    const p = studentProgressMap[s.id];
    if (p !== 'completed') {
      return { targetSectionId: s.id, variant: 'start' };
    }
  }

  return { targetSectionId: sorted[0].id, variant: 'review' };
}
