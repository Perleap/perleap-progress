/**
 * Syllabus Query Hooks
 * React Query hooks for syllabus operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSyllabusByClassroom,
  createSyllabus,
  updateSyllabus,
  publishSyllabus,
  archiveSyllabus,
  createSyllabusSection,
  updateSyllabusSection,
  deleteSyllabusSection,
  reorderSyllabusSections,
  createGradingCategory,
  updateGradingCategory,
  deleteGradingCategory,
  linkAssignmentToSection,
  unlinkAssignmentFromSection,
} from '@/services/syllabusService';
import type {
  CreateSyllabusInput,
  UpdateSyllabusInput,
  CreateSyllabusSectionInput,
  UpdateSyllabusSectionInput,
  CreateGradingCategoryInput,
  UpdateGradingCategoryInput,
} from '@/types/syllabus';
import { assignmentKeys } from './useAssignmentQueries';

export const syllabusKeys = {
  all: ['syllabus'] as const,
  byClassroom: (classroomId: string) => [...syllabusKeys.all, 'classroom', classroomId] as const,
};

// ---------------------------------------------------------------------------
// Syllabus
// ---------------------------------------------------------------------------

export const useSyllabus = (classroomId: string | undefined) => {
  return useQuery({
    queryKey: syllabusKeys.byClassroom(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');
      const { data, error } = await getSyllabusByClassroom(classroomId);
      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateSyllabus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSyllabusInput) => {
      const { data, error } = await createSyllabus(input);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(variables.classroom_id) });
    },
  });
};

export const useUpdateSyllabus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ syllabusId, updates, classroomId }: {
      syllabusId: string;
      updates: UpdateSyllabusInput;
      classroomId: string;
    }) => {
      const { data, error } = await updateSyllabus(syllabusId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const usePublishSyllabus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ syllabusId, classroomId }: { syllabusId: string; classroomId: string }) => {
      const { data, error } = await publishSyllabus(syllabusId);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const useArchiveSyllabus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ syllabusId, classroomId }: { syllabusId: string; classroomId: string }) => {
      const { data, error } = await archiveSyllabus(syllabusId);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export const useCreateSyllabusSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, classroomId }: { input: CreateSyllabusSectionInput; classroomId: string }) => {
      const { data, error } = await createSyllabusSection(input);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const useUpdateSyllabusSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, updates, classroomId }: {
      sectionId: string;
      updates: UpdateSyllabusSectionInput;
      classroomId: string;
    }) => {
      const { data, error } = await updateSyllabusSection(sectionId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const useDeleteSyllabusSection = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, classroomId }: { sectionId: string; classroomId: string }) => {
      const { error } = await deleteSyllabusSection(sectionId);
      if (error) throw error;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const useReorderSyllabusSections = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ syllabusId, orderedIds, classroomId }: {
      syllabusId: string;
      orderedIds: string[];
      classroomId: string;
    }) => {
      const { error } = await reorderSyllabusSections(syllabusId, orderedIds);
      if (error) throw error;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

// ---------------------------------------------------------------------------
// Grading Categories
// ---------------------------------------------------------------------------

export const useCreateGradingCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, classroomId }: { input: CreateGradingCategoryInput; classroomId: string }) => {
      const { data, error } = await createGradingCategory(input);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const useUpdateGradingCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoryId, updates, classroomId }: {
      categoryId: string;
      updates: UpdateGradingCategoryInput;
      classroomId: string;
    }) => {
      const { data, error } = await updateGradingCategory(categoryId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const useDeleteGradingCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ categoryId, classroomId }: { categoryId: string; classroomId: string }) => {
      const { error } = await deleteGradingCategory(categoryId);
      if (error) throw error;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

// ---------------------------------------------------------------------------
// Assignment Linking
// ---------------------------------------------------------------------------

export const useLinkAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, sectionId, gradingCategoryId, classroomId }: {
      assignmentId: string;
      sectionId: string;
      gradingCategoryId?: string | null;
      classroomId: string;
    }) => {
      const { error } = await linkAssignmentToSection(assignmentId, sectionId, gradingCategoryId);
      if (error) throw error;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.listByClassroom(classroomId) });
    },
  });
};

export const useUnlinkAssignment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, classroomId }: { assignmentId: string; classroomId: string }) => {
      const { error } = await unlinkAssignmentFromSection(assignmentId);
      if (error) throw error;
    },
    onSuccess: (_, { classroomId }) => {
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      queryClient.invalidateQueries({ queryKey: assignmentKeys.listByClassroom(classroomId) });
    },
  });
};
