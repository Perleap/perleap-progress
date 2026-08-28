import { useParams } from 'react-router-dom';
import { ClassroomActivityPageContent } from '@/components/features/syllabus';

type Role = 'teacher' | 'student';

export default function ClassroomActivityPage({ role }: { role: Role }) {
  const { id: idParam, classroomId: classroomIdParam, resourceId } = useParams<{
    id?: string;
    classroomId?: string;
    resourceId: string;
  }>();
  const classroomId = classroomIdParam ?? idParam;

  if (!classroomId || !resourceId) {
    return null;
  }

  return (
    <ClassroomActivityPageContent role={role} classroomId={classroomId} resourceId={resourceId} />
  );
}
