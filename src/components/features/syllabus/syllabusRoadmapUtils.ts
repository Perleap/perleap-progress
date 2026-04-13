import type { SyllabusSection, SectionStatus, ReleaseMode, StudentProgressStatus } from '@/types/syllabus';
import { isSectionUnlocked } from '@/lib/sectionUnlock';

export function deriveSectionStatus(section: SyllabusSection): SectionStatus {
  if (section.completion_status === 'completed') return 'completed';
  if (section.completion_status === 'skipped') return 'skipped';

  const now = new Date();
  const start = section.start_date ? new Date(section.start_date) : null;
  const end = section.end_date ? new Date(section.end_date) : null;

  if (end && now > end) return 'completed';
  if (start && now >= start) return 'in_progress';
  return 'upcoming';
}

export function isTodayInDateRange(start: string | null, end: string | null): boolean {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const t = today.getTime();
  const dayStart = (s: string) => {
    const d = new Date(s);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const dayEnd = (s: string) => {
    const d = new Date(s);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  };
  if (start && end) return t >= dayStart(start) && t <= dayEnd(end);
  if (start && !end) return t >= dayStart(start);
  if (!start && end) return t <= dayEnd(end);
  return false;
}

export type RoadmapSectionFilter = 'all' | 'assignments' | 'resources' | 'locked';

export function filterRoadmapSections(
  sections: SyllabusSection[],
  filter: RoadmapSectionFilter,
  mode: 'teacher' | 'student',
  assignmentCounts: Record<string, number>,
  sectionResources: Record<string, unknown[]>,
  releaseMode: ReleaseMode,
  studentProgressMap: Record<string, StudentProgressStatus>
): SyllabusSection[] {
  if (filter === 'all') return sections;
  return sections.filter((s) => {
    const locked =
      mode === 'student' &&
      !isSectionUnlocked(s, sections, releaseMode, studentProgressMap);
    if (filter === 'assignments') return (assignmentCounts[s.id] || 0) > 0;
    if (filter === 'resources') return (sectionResources[s.id] || []).length > 0;
    if (filter === 'locked') return mode === 'student' && locked;
    return true;
  });
}

export function deriveCurrentSectionDisplayIndex(statuses: SectionStatus[]): number {
  const n = statuses.length;
  if (n === 0) return 0;
  const inProg = statuses.findIndex((s) => s === 'in_progress');
  if (inProg >= 0) return inProg + 1;
  const up = statuses.findIndex((s) => s === 'upcoming');
  if (up >= 0) return up + 1;
  return n;
}

export function roadmapProgressPercent(statuses: SectionStatus[]): number {
  if (statuses.length === 0) return 0;
  const done = statuses.filter((s) => s === 'completed' || s === 'skipped').length;
  return Math.round((done / statuses.length) * 100);
}
