import type { Classroom, Assignment } from '@/types/models';
import { EditAssignmentDialog } from '@/components/features/assignment/dialogs';
import { ClassroomDeleteDialog } from '@/components/features/classroom/ClassroomDeleteDialog';
import { ClassroomResetDialogs } from '@/components/features/classroom/ClassroomResetDialogs';
import { EditClassroomDialog } from '@/components/features/classroom/dialogs';

type TeacherClassroomDialogsProps = {
  classroomId: string;
  classroom: Classroom;
  assignments: Assignment[];
  studentsCount: number;
  isRTL: boolean;
  isAppAdmin: boolean;
  teacherUserId?: string;
  onDeleted: () => void;
  onClassroomUpdated: () => void;
  onAssignmentsUpdated: () => void;
  dialogs: {
    editDialogOpen: boolean;
    setEditDialogOpen: (open: boolean) => void;
    editAssignmentDialogOpen: boolean;
    setEditAssignmentDialogOpen: (open: boolean) => void;
    selectedAssignment: Assignment | null;
    deleteDialogOpen: boolean;
    setDeleteDialogOpen: (open: boolean) => void;
    resetConfirmDialogOpen: boolean;
    setResetConfirmDialogOpen: (open: boolean) => void;
  };
};

export const TeacherClassroomDialogs = ({
  classroomId,
  classroom,
  assignments,
  studentsCount,
  isRTL,
  isAppAdmin,
  teacherUserId,
  onDeleted,
  onClassroomUpdated,
  onAssignmentsUpdated,
  dialogs,
}: TeacherClassroomDialogsProps) => {
  const {
    editDialogOpen,
    setEditDialogOpen,
    editAssignmentDialogOpen,
    setEditAssignmentDialogOpen,
    selectedAssignment,
    deleteDialogOpen,
    setDeleteDialogOpen,
    resetConfirmDialogOpen,
    setResetConfirmDialogOpen,
  } = dialogs;

  return (
    <>
      <EditClassroomDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        classroom={classroom}
        onSuccess={onClassroomUpdated}
      />

      {selectedAssignment && (
        <EditAssignmentDialog
          open={editAssignmentDialogOpen}
          onOpenChange={setEditAssignmentDialogOpen}
          assignment={selectedAssignment}
          onSuccess={onAssignmentsUpdated}
        />
      )}

      <ClassroomDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        classroomId={classroomId}
        classroomName={classroom.name}
        assignmentCount={assignments.length}
        studentCount={studentsCount}
        isRTL={isRTL}
        restrictToTeacherId={isAppAdmin ? undefined : teacherUserId}
        isAppAdmin={isAppAdmin}
        onDeleted={onDeleted}
      />

      <ClassroomResetDialogs
        classroomId={classroomId}
        classroomName={classroom.name}
        isRTL={isRTL}
        confirmOpen={resetConfirmDialogOpen}
        onConfirmOpenChange={setResetConfirmDialogOpen}
        assignmentCount={assignments.length}
        studentCount={studentsCount}
        isAppAdmin={isAppAdmin}
      />
    </>
  );
};
