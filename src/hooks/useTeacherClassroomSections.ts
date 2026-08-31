import { BarChart3, FileText, Info, Map, Users } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ClassroomLocationState } from '@/types/navigation';

export const TEACHER_SECTION_IDS = new Set([
  'overview',
  'outline',
  'students',
  'submissions',
  'analytics',
]);

function normalizeSection(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (raw === 'activities' || raw === 'assignments' || raw === 'curriculum') return 'outline';
  return raw;
}

export function useTeacherClassroomSections() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState(() => {
    const normalized = normalizeSection(
      (location.state as ClassroomLocationState | null)?.activeSection
    );
    return normalized && TEACHER_SECTION_IDS.has(normalized) ? normalized : 'overview';
  });

  useEffect(() => {
    const normalized = normalizeSection(
      (location.state as ClassroomLocationState | null)?.activeSection
    );
    if (normalized === undefined) return;
    if (TEACHER_SECTION_IDS.has(normalized)) {
      setActiveSection(normalized);
    }
  }, [location.pathname, location.key, location.state]);

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: { activeSection: section } }
    );
  };

  const submissionsAssignmentId = (location.state as ClassroomLocationState | null)
    ?.submissionsAssignmentId;

  const classroomSections = useMemo(
    () => [
      { id: 'overview', title: t('studentClassroom.about'), icon: Info },
      { id: 'outline', title: 'Course Outline', icon: Map },
      { id: 'students', title: t('classroomDetail.students'), icon: Users },
      { id: 'submissions', title: t('classroomDetail.submissionsTab'), icon: FileText },
      { id: 'analytics', title: t('classroomDetail.analytics'), icon: BarChart3 },
    ],
    [t]
  );

  return {
    activeSection,
    handleSectionChange,
    submissionsAssignmentId,
    classroomSections,
  };
}
