import { useParams } from 'react-router-dom';
import { LiveSessionContent } from '@/components/features/liveSession';

const LiveSessionPage = () => {
  const { id: classroomId, assignmentId } = useParams<{ id: string; assignmentId: string }>();

  if (!classroomId || !assignmentId) {
    return null;
  }

  return <LiveSessionContent classroomId={classroomId} assignmentId={assignmentId} />;
};

export default LiveSessionPage;
