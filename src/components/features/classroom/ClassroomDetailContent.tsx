import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Classroom, Assignment } from '@/types/models';
import { TeacherClassroomAnalyticsSection } from '@/components/features/classroom/TeacherClassroomAnalyticsSection';
import { TeacherClassroomDialogs } from '@/components/features/classroom/TeacherClassroomDialogs';
import { TeacherClassroomOverviewSection } from '@/components/features/classroom/TeacherClassroomOverviewSection';
import { TeacherClassroomStudentsSection } from '@/components/features/classroom/TeacherClassroomStudentsSection';
import { TeacherClassroomSubmissionsSection } from '@/components/features/classroom/TeacherClassroomSubmissionsSection';
import { CourseOutlineSection } from '@/components/features/syllabus';
import { ClassroomLayout } from '@/components/layouts';
import { USER_ROLES } from '@/config/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/useAuth';
import {
  useClassroom,
  useClassroomAssignments,
  useClassroomStudents,
  useClassroomResetPreview,
} from '@/hooks/queries';
import { useClassroomDetailDialogs } from '@/hooks/useClassroomDetailDialogs';
import { useTeacherClassroomSections } from '@/hooks/useTeacherClassroomSections';

type ClassroomDetailContentProps = {
  classroomId: string;
  classroom: Classroom;
};

export const ClassroomDetailContent = ({ classroomId, classroom }: ClassroomDetailContentProps) => {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const isAppAdmin = user?.user_metadata?.role === USER_ROLES.ADMIN;

  const { refetch: refetchClassroom } = useClassroom(classroomId);
  const { data: rawAssignments = [], refetch: refetchAssignments } =
    useClassroomAssignments(classroomId);
  const { data: students = [], isLoading: studentsLoading } = useClassroomStudents(classroomId);
  const { data: resetPreview, isLoading: resetPreviewLoading } = useClassroomResetPreview(
    classroomId,
    true
  );

  const { activeSection, handleSectionChange, submissionsAssignmentId, classroomSections } =
    useTeacherClassroomSections();

  const dialogs = useClassroomDetailDialogs();
  const assignments = useMemo(() => rawAssignments as unknown as Assignment[], [rawAssignments]);

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
            onEdit={dialogs.openEditClassroom}
            onRequestReset={dialogs.openReset}
            onRequestDelete={dialogs.openDelete}
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
              if (row) dialogs.openEditAssignment(row);
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

      <TeacherClassroomDialogs
        classroomId={classroomId}
        classroom={classroom}
        assignments={assignments}
        studentsCount={students.length}
        isRTL={isRTL}
        isAppAdmin={isAppAdmin}
        teacherUserId={user?.id}
        onDeleted={() => navigate('/teacher/dashboard')}
        onClassroomUpdated={() => void refetchClassroom()}
        onAssignmentsUpdated={() => void refetchAssignments()}
        dialogs={dialogs}
      />
    </ClassroomLayout>
  );
};
