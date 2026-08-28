import { useParams } from 'react-router-dom';
import { AssignmentDetailContent } from '@/components/features/assignment';
const AssignmentDetail = () => {
  const params = useParams<{ id?: string; classroomId?: string; assignmentId?: string }>();
  const assignmentId = params.assignmentId ?? params.id ?? '';
  const teacherRouteClassroomId = params.classroomId;
  const isTeacherTry = Boolean(teacherRouteClassroomId && params.assignmentId);

  if (!assignmentId) {
    return null;
  }

  return (
    <AssignmentDetailContent
      assignmentId={assignmentId}
      isTeacherTry={isTeacherTry}
      teacherRouteClassroomId={teacherRouteClassroomId}
    />
  );
};

export default AssignmentDetail;
