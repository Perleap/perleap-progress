import { useParams } from 'react-router-dom';
import { SubmissionDetailContent } from '@/components/features/submission';

const SubmissionDetail = () => {
  const { id } = useParams();

  if (!id) {
    return null;
  }

  return <SubmissionDetailContent submissionId={id} />;
};

export default SubmissionDetail;
