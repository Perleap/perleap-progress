import { useState, useCallback } from 'react';
import type { Assignment } from '@/types/models';

export function useClassroomDetailDialogs() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAssignmentDialogOpen, setEditAssignmentDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetConfirmDialogOpen, setResetConfirmDialogOpen] = useState(false);

  const openEditClassroom = useCallback(() => setEditDialogOpen(true), []);
  const openDelete = useCallback(() => setDeleteDialogOpen(true), []);
  const openReset = useCallback(() => setResetConfirmDialogOpen(true), []);

  const openEditAssignment = useCallback((assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setEditAssignmentDialogOpen(true);
  }, []);

  return {
    editDialogOpen,
    setEditDialogOpen,
    editAssignmentDialogOpen,
    setEditAssignmentDialogOpen,
    selectedAssignment,
    deleteDialogOpen,
    setDeleteDialogOpen,
    resetConfirmDialogOpen,
    setResetConfirmDialogOpen,
    openEditClassroom,
    openDelete,
    openReset,
    openEditAssignment,
  };
}
