import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { USER_ROLES } from '@/config/constants';
import { useAuth } from '@/contexts/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Users,
  BarChart3,
  FileText,
  Info,
  Map,
} from 'lucide-react';
import { EditClassroomDialog } from '@/components/EditClassroomDialog';
import { EditAssignmentDialog } from '@/components/EditAssignmentDialog';
import { ClassroomLayout } from '@/components/layouts';
import { CourseOutlineSection } from '@/components/features/syllabus';
import { TeacherClassroomOverviewSection } from '@/components/features/classroom/TeacherClassroomOverviewSection';
import { TeacherClassroomStudentsSection } from '@/components/features/classroom/TeacherClassroomStudentsSection';
import { TeacherClassroomSubmissionsSection } from '@/components/features/classroom/TeacherClassroomSubmissionsSection';
import { TeacherClassroomAnalyticsSection } from '@/components/features/classroom/TeacherClassroomAnalyticsSection';
import { ClassroomDeleteDialog } from '@/components/features/classroom/ClassroomDeleteDialog';
import { ClassroomResetDialogs } from '@/components/features/classroom/ClassroomResetDialogs';
import {
  useClassroom,
  useClassroomAssignments,
  useClassroomStudents,
  useClassroomResetPreview,
} from '@/hooks/queries';
import type { ClassroomLocationState } from '@/types/navigation';
import type { Classroom, Assignment } from '@/types/models';

const TEACHER_SECTION_IDS = new Set([
  'overview',
  'outline',
  'students',
  'submissions',
  'analytics',
]);

type ClassroomDetailContentProps = {
  classroomId: string;
  classroom: Classroom;
};

export function ClassroomDetailContent({ classroomId, classroom }: ClassroomDetailContentProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const isAppAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const { refetch: refetchClassroom } = useClassroom(classroomId);

  const { data: rawAssignments = [], refetch: refetchAssignments } =
    useClassroomAssignments(classroomId);
  const { data: students = [], isLoading: studentsLoading } =
    useClassroomStudents(classroomId);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAssignmentDialogOpen, setEditAssignmentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetConfirmDialogOpen, setResetConfirmDialogOpen] = useState(false);
  const { data: resetPreview, isLoading: resetPreviewLoading } =
    useClassroomResetPreview(classroomId, true);

  const [activeSection, setActiveSection] = useState(() => {
    const raw = (location.state as ClassroomLocationState | null)?.activeSection;
    const normalized =
      raw === 'activities' || raw === 'assignments' || raw === 'curriculum' ? 'outline' : raw;
    return normalized && TEACHER_SECTION_IDS.has(normalized) ? normalized : 'overview';
  });

  useEffect(() => {
    const raw = (location.state as ClassroomLocationState | null)?.activeSection;
    if (raw === undefined) return;
    const normalized =
      raw === 'activities' || raw === 'assignments' || raw === 'curriculum' ? 'outline' : raw;
    if (TEACHER_SECTION_IDS.has(normalized)) {
      setActiveSection(normalized);
    }
  }, [location.pathname, location.key]);

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: { activeSection: section } },
    );
  };

  const assignments = useMemo(() => rawAssignments as unknown as Assignment[], [rawAssignments]);

  const submissionsAssignmentId =
    (location.state as ClassroomLocationState | null)?.submissionsAssignmentId;

  const classroomSections = [
    { id: 'overview', title: t('studentClassroom.about'), icon: Info },
    { id: 'outline', title: 'Course Outline', icon: Map },
    { id: 'students', title: t('classroomDetail.students'), icon: Users },
    { id: 'submissions', title: t('classroomDetail.submissionsTab'), icon: FileText },
    { id: 'analytics', title: t('classroomDetail.analytics'), icon: BarChart3 },
  ];

  return (
    <ClassroomLayout
      classroomName={classroom.name}
      classroomSubject={classroom.subject}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      customSections={classroomSections}
    >
      <div className="space-y-6 md:space-y-8" dir={isRTL ? 'rtl' : 'ltr'}>
        {activeSection === 'overview' && (
          <TeacherClassroomOverviewSection
            classroomId={classroomId}
            classroom={classroom}
            isRTL={isRTL}
            onEdit={() => setEditDialogOpen(true)}
            onRequestReset={() => setResetConfirmDialogOpen(true)}
            onRequestDelete={() => setDeleteDialogOpen(true)}
            resetButtonDisabled={
              resetPreviewLoading ||
              !(
                (resetPreview?.active_enrollments ?? students.length) > 0 ||
                (resetPreview?.submissions ?? 0) > 0
              )
            }
          />
        )}

        {activeSection === 'outline' && (
          <CourseOutlineSection
            classroomId={classroomId}
            isRTL={isRTL}
            onTeacherSelectAssignment={(assignmentId) => {
              const row = assignments.find((a) => a.id === assignmentId);
              if (row) {
                setSelectedAssignment(row);
                setEditAssignmentDialogOpen(true);
              }
            }}
          />
        )}

        {activeSection === 'students' && (
          <TeacherClassroomStudentsSection
            classroomId={classroomId}
            isRTL={isRTL}
            students={students}
            isLoading={studentsLoading}
          />
        )}

        {activeSection === 'submissions' && (
          <TeacherClassroomSubmissionsSection
            classroomId={classroomId}
            isRTL={isRTL}
            initialAssignmentFilterId={submissionsAssignmentId}
          />
        )}

        {activeSection === 'analytics' && (
          <TeacherClassroomAnalyticsSection
            classroomId={classroomId}
            classroomName={classroom.name}
            isRTL={isRTL}
          />
        )}
      </div>

      <EditClassroomDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        classroom={classroom}
        onSuccess={refetchClassroom}
      />

      {selectedAssignment && (
        <EditAssignmentDialog
          open={editAssignmentDialogOpen}
          onOpenChange={setEditAssignmentDialogOpen}
          assignment={selectedAssignment}
          onSuccess={refetchAssignments}
        />
      )}

      <ClassroomDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        classroomId={classroomId}
        classroomName={classroom.name}
        assignmentCount={assignments.length}
        studentCount={students.length}
        isRTL={isRTL}
        restrictToTeacherId={isAppAdmin ? undefined : user?.id}
        isAppAdmin={isAppAdmin}
        onDeleted={() => navigate('/teacher/dashboard')}
      />

      <ClassroomResetDialogs
        classroomId={classroomId}
        isRTL={isRTL}
        confirmOpen={resetConfirmDialogOpen}
        onConfirmOpenChange={setResetConfirmDialogOpen}
        assignmentCount={assignments.length}
        studentCount={students.length}
        isAppAdmin={isAppAdmin}
      />
    </ClassroomLayout>
  );
}
