import { CreateClassroomWizard } from '@/components/features/syllabus/CreateClassroomWizard';

interface CreateClassroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (classroomId: string) => void;
}

export const CreateClassroomDialog = (props: CreateClassroomDialogProps) => {
  return <CreateClassroomWizard {...props} />;
};
