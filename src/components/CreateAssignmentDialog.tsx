import {
  AssignmentWizardDialog,
  type AssignmentWizardCreateInitialData,
} from '@/components/features/assignment/wizard';

interface CreateAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomId: string;
  onSuccess: () => void;
  initialData?: AssignmentWizardCreateInitialData;
  assignedStudentId?: string;
  studentName?: string;
  lockSyllabusSection?: boolean;
  onCreatedAssignment?: (assignmentId: string) => void;
}

export function CreateAssignmentDialog({
  open,
  onOpenChange,
  classroomId,
  onSuccess,
  initialData,
  assignedStudentId,
  studentName,
  lockSyllabusSection = false,
  onCreatedAssignment,
}: CreateAssignmentDialogProps) {
  return (
    <AssignmentWizardDialog
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      classroomId={classroomId}
      onSuccess={onSuccess}
      initialData={initialData}
      assignedStudentId={assignedStudentId}
      studentName={studentName}
      lockSyllabusSection={lockSyllabusSection}
      onCreatedAssignment={onCreatedAssignment}
    />
  );
}
