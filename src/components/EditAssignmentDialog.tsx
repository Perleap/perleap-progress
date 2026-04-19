import { AssignmentWizardDialog, type AssignmentForWizardEdit } from '@/components/features/assignment/wizard';

interface EditAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: AssignmentForWizardEdit;
  onSuccess: () => void;
}

export function EditAssignmentDialog({ open, onOpenChange, assignment, onSuccess }: EditAssignmentDialogProps) {
  return (
    <AssignmentWizardDialog mode="edit" open={open} onOpenChange={onOpenChange} assignment={assignment} onSuccess={onSuccess} />
  );
}
