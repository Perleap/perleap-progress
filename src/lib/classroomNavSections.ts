import type { TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, FileText, Info, LayoutList, Map, Users } from 'lucide-react';

export type ClassroomNavSection = {
  id: string;
  title: string;
  icon: LucideIcon;
};

export function getStudentClassroomNavSections(
  t: TFunction,
  hasPublishedSyllabus: boolean,
): ClassroomNavSection[] {
  return [
    { id: 'overview', title: t('studentClassroom.about'), icon: Info },
    ...(hasPublishedSyllabus
      ? [{ id: 'curriculum', title: t('classroomDetail.curriculum.tabTitle'), icon: LayoutList }]
      : []),
  ];
}

export function getTeacherClassroomNavSections(t: TFunction): ClassroomNavSection[] {
  return [
    { id: 'overview', title: t('studentClassroom.about'), icon: Info },
    { id: 'outline', title: 'Course Outline', icon: Map },
    { id: 'students', title: t('classroomDetail.students'), icon: Users },
    { id: 'submissions', title: t('classroomDetail.submissionsTab'), icon: FileText },
    { id: 'analytics', title: t('classroomDetail.analytics'), icon: BarChart3 },
  ];
}
