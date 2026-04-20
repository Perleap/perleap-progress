import type { ReleaseMode, StudentProgressStatus, SyllabusSection } from '@/types/syllabus';

export type StudyCtaVariant = 'continue' | 'start' | 'review';

export type GetStudyCtaTargetOptions = {
  /**
   * Student About-page primary button: always open the first module in outline order (`order_index`)
   * and derive Start / Continue / Review from *that* module only so label matches destination.
   * Default behavior picks the first *incomplete* module (resume / skip completed).
   */
  aboutPrimaryCta?: boolean;
};

function variantForSectionProgress(p: StudentProgressStatus | undefined): StudyCtaVariant {
  if (p === 'in_progress' || p === 'reviewed') return 'continue';
  if (p === 'completed') return 'review';
  return 'start';
}

export function getStudyCtaTarget(
  sections: SyllabusSection[],
  _releaseMode: ReleaseMode,
  studentProgressMap: Record<string, StudentProgressStatus>,
  options?: GetStudyCtaTargetOptions
): { targetSectionId: string | null; variant: StudyCtaVariant } {
  const sorted = [...sections].sort((a, b) => a.order_index - b.order_index);
  if (sorted.length === 0) {
    return { targetSectionId: null, variant: 'start' };
  }

  if (options?.aboutPrimaryCta) {
    const first = sorted[0];
    const p = studentProgressMap[first.id];
    const variant = variantForSectionProgress(p);
    return { targetSectionId: first.id, variant };
  }

  for (const s of sorted) {
    const p = studentProgressMap[s.id];
    if (p === 'completed') continue;

    const variant: StudyCtaVariant = p === 'in_progress' || p === 'reviewed' ? 'continue' : 'start';
    return { targetSectionId: s.id, variant };
  }

  return { targetSectionId: sorted[0].id, variant: 'review' };
}
