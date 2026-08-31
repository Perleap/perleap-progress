import type { Classroom, Domain, CourseMaterial } from '@/types/models';

export type StudentClassroomDetailView = {
  id: string;
  name: string;
  subject: string;
  course_title: string;
  start_date: string;
  end_date: string;
  resources: string;
  teacher_id?: string;
  learning_outcomes: string[];
  key_challenges: string[];
};

export function normalizeClassroomDetail(
  raw: Record<string, unknown> | null | undefined
): Classroom | null {
  if (!raw) return null;
  return {
    ...raw,
    learning_outcomes: Array.isArray(raw.learning_outcomes)
      ? raw.learning_outcomes.map(String)
      : null,
    key_challenges: Array.isArray(raw.key_challenges) ? raw.key_challenges.map(String) : null,
    domains: raw.domains as Domain[] | null,
    materials: raw.materials as CourseMaterial[] | null,
  } as unknown as Classroom;
}

export function normalizeStudentClassroomDetail(
  raw: Record<string, unknown> | null | undefined
): StudentClassroomDetailView | null {
  if (!raw) return null;
  const base = normalizeClassroomDetail(raw);
  if (!base) return null;
  return {
    id: base.id,
    name: base.name,
    subject: base.subject,
    course_title: String(raw.course_title ?? base.name),
    start_date: String(raw.start_date ?? ''),
    end_date: String(raw.end_date ?? ''),
    resources: String(raw.resources ?? ''),
    teacher_id: raw.teacher_id as string | undefined,
    learning_outcomes: Array.isArray(raw.learning_outcomes)
      ? raw.learning_outcomes.map(String)
      : [],
    key_challenges: Array.isArray(raw.key_challenges) ? raw.key_challenges.map(String) : [],
  };
}
