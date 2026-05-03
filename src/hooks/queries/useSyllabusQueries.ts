/**
 * Syllabus Query Hooks
 * React Query hooks for syllabus operations
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { analyticsKeys } from '@/hooks/queries/useAnalyticsQueries';
import { nuanceKeys } from '@/hooks/queries/useNuanceQueries';
import { moduleFlowKeys } from '@/hooks/queries/useModuleFlowQueries';
import { syncModuleFlowToResolvedDisplayForSection } from '@/hooks/queries/moduleFlowSync';
import {
  getSyllabusByClassroom,
  getSyllabusOutlineByClassroom,
  createSyllabus,
  provisionSyllabusBundle,
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
  getAssignmentsBySection,
  getSectionAssignmentProgress,
} from '@/services/syllabusService';
import {
  getSectionResources,
  getSectionResourceById,
  uploadAndCreateResource,
  createLinkResource,
  createSectionResource,
  updateSectionResource,
  deleteSectionResource,
  upsertStudentProgress,
  getStudentProgress,
  getChangelog,
  createChangelogEntry,
  getSectionComments,
  createSectionComment,
  deleteSectionComment,
} from '@/services/syllabusResourceService';
import type {
  CreateSyllabusInput,
  UpdateSyllabusInput,
  CreateSyllabusSectionInput,
  UpdateSyllabusSectionInput,
  CreateGradingCategoryInput,
  UpdateGradingCategoryInput,
  StudentProgressStatus,
  SyllabusWithSections,
  ProvisionSyllabusBundleInput,
  UpdateSectionResourceInput,
  ActivityResourceStatus,
  LessonContentV1,
} from '@/types/syllabus';
import { assignmentKeys } from './useAssignmentQueries';

export const syllabusKeys = {
  all: ['syllabus'] as const,
  byClassroom: (classroomId: string) => [...syllabusKeys.all, 'classroom', classroomId] as const,
  outlineByClassroom: (classroomId: string) => [...syllabusKeys.all, 'outline', classroomId] as const,
};

// ---------------------------------------------------------------------------
// Syllabus
// ---------------------------------------------------------------------------

/**
 * Align with QueryClient defaults (2m). Syllabus/link/module-flow mutations invalidate
 * syllabusKeys.byClassroom so teacher/student edits refresh promptly.
 */
const SYLLABUS_STALE_MS = 2 * 60 * 1000;

/** Warm cache before opening classroom detail (reduces nav + CTA layout jumps). */
export function prefetchSyllabusByClassroom(queryClient: QueryClient, classroomId: string | undefined) {
  if (!classroomId) return;
  return queryClient.prefetchQuery({
    queryKey: syllabusKeys.byClassroom(classroomId),
    queryFn: async () => {
      const { data, error } = await getSyllabusByClassroom(classroomId);
      if (error) throw error;
      return data;
    },
    staleTime: SYLLABUS_STALE_MS,
  });
}

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
    staleTime: SYLLABUS_STALE_MS,
  });
};

export function prefetchSyllabusOutlineByClassroom(
  queryClient: QueryClient,
  classroomId: string | undefined,
  staleTimeMs: number = SYLLABUS_STALE_MS,
) {
  if (!classroomId) return;
  return queryClient.prefetchQuery({
    queryKey: syllabusKeys.outlineByClassroom(classroomId),
    queryFn: async () => {
      const { data, error } = await getSyllabusOutlineByClassroom(classroomId);
      if (error) throw error;
      return data;
    },
    staleTime: staleTimeMs,
  });
}

export const useSyllabusOutlineForClassroom = (
  classroomId: string | undefined,
  options?: { staleTime?: number },
) => {
  return useQuery({
    queryKey: syllabusKeys.outlineByClassroom(classroomId || ''),
    queryFn: async () => {
      if (!classroomId) throw new Error('Missing classroom ID');
      const { data, error } = await getSyllabusOutlineByClassroom(classroomId);
      if (error) throw error;
      return data;
    },
    enabled: !!classroomId,
    staleTime: options?.staleTime ?? SYLLABUS_STALE_MS,
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

export const useProvisionSyllabusBundle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProvisionSyllabusBundleInput) => {
      const { data, error } = await provisionSyllabusBundle(input);
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
    onMutate: async ({ input, classroomId }) => {
      await queryClient.cancelQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      const prev = queryClient.getQueryData<SyllabusWithSections | null>(syllabusKeys.byClassroom(classroomId));
      if (prev) {
        const optimistic = {
          ...prev,
          sections: [
            ...prev.sections,
            {
              id: `temp-${Date.now()}`,
              syllabus_id: input.syllabus_id,
              title: input.title,
              description: input.description,
              content: input.content ?? null,
              order_index: input.order_index,
              start_date: input.start_date,
              end_date: input.end_date,
              objectives: input.objectives,
              resources: input.resources,
              notes: input.notes,
              completion_status: input.completion_status ?? 'auto',
              prerequisites: (input.prerequisites as string[] | null | undefined) ?? [],
              is_locked: input.is_locked ?? false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        };
        queryClient.setQueryData(syllabusKeys.byClassroom(classroomId), optimistic);
      }
      return { prev };
    },
    onError: (_err, { classroomId }, context) => {
      if (context?.prev) {
        queryClient.setQueryData(syllabusKeys.byClassroom(classroomId), context.prev);
      }
    },
    onSuccess: (data, { classroomId }) => {
      queryClient.setQueryData<SyllabusWithSections | null>(
        syllabusKeys.byClassroom(classroomId),
        (old) => {
          if (!old) return old;
          const newSections = old.sections.map(s => 
            (s.id.startsWith('temp-') && s.order_index === data.order_index) ? data : s
          );
          if (!newSections.some(s => s.id === data.id)) {
            const replaced = old.sections.some(s => s.id.startsWith('temp-') && s.order_index === data.order_index);
            if (!replaced) newSections.push(data);
          }
          return { ...old, sections: newSections };
        }
      );
    },
    onSettled: (_, _err, { classroomId }) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      }, 500);
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
    onMutate: async ({ sectionId, updates, classroomId }) => {
      await queryClient.cancelQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      const prev = queryClient.getQueryData<SyllabusWithSections | null>(syllabusKeys.byClassroom(classroomId));
      if (prev) {
        queryClient.setQueryData(syllabusKeys.byClassroom(classroomId), {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId ? { ...s, ...updates, updated_at: new Date().toISOString() } : s
          ),
        });
      }
      return { prev };
    },
    onError: (_err, { classroomId }, context) => {
      if (context?.prev) queryClient.setQueryData(syllabusKeys.byClassroom(classroomId), context.prev);
    },
    onSettled: (_, _err, { classroomId }) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      }, 500);
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
    onMutate: async ({ sectionId, classroomId }) => {
      await queryClient.cancelQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      const prev = queryClient.getQueryData<SyllabusWithSections | null>(syllabusKeys.byClassroom(classroomId));
      if (prev) {
        queryClient.setQueryData(syllabusKeys.byClassroom(classroomId), {
          ...prev,
          sections: prev.sections.filter((s) => s.id !== sectionId),
        });
      }
      return { prev };
    },
    onError: (_err, { classroomId }, context) => {
      if (context?.prev) queryClient.setQueryData(syllabusKeys.byClassroom(classroomId), context.prev);
    },
    onSettled: (_, _err, { classroomId }) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      }, 500);
    },
  });
};

export const useReorderSyllabusSections = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ syllabusId, orderedIds, classroomId, swapPair }: {
      syllabusId: string;
      orderedIds: string[];
      classroomId: string;
      swapPair?: [number, number];
    }) => {
      const { error } = await reorderSyllabusSections(syllabusId, orderedIds, swapPair);
      if (error) throw error;
    },
    onMutate: async ({ orderedIds, classroomId }) => {
      await queryClient.cancelQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      const prev = queryClient.getQueryData<SyllabusWithSections | null>(syllabusKeys.byClassroom(classroomId));
      if (prev) {
        const sectionMap = new Map(prev.sections.map((s) => [s.id, s]));
        const reordered = orderedIds
          .map((id, i) => {
            const s = sectionMap.get(id);
            return s ? { ...s, order_index: i } : null;
          })
          .filter(Boolean);
        queryClient.setQueryData(syllabusKeys.byClassroom(classroomId), {
          ...prev,
          sections: reordered,
        });
      }
      return { prev };
    },
    onError: (_err, { classroomId }, context) => {
      if (context?.prev) queryClient.setQueryData(syllabusKeys.byClassroom(classroomId), context.prev);
    },
    onSettled: (_, _err, { classroomId }) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      }, 500);
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
      queryClient.invalidateQueries({ queryKey: analyticsKeys.classroom(classroomId) });
      queryClient.invalidateQueries({ queryKey: nuanceKeys.insights(classroomId) });
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
      queryClient.invalidateQueries({ queryKey: analyticsKeys.classroom(classroomId) });
      queryClient.invalidateQueries({ queryKey: nuanceKeys.insights(classroomId) });
    },
  });
};

// ---------------------------------------------------------------------------
// Section Resources
// ---------------------------------------------------------------------------

export const resourceKeys = {
  all: ['section-resources'] as const,
  bySection: (sectionId: string) => [...resourceKeys.all, sectionId] as const,
};

export const useSectionResources = (sectionId: string | undefined) => {
  return useQuery({
    queryKey: resourceKeys.bySection(sectionId || ''),
    queryFn: async () => {
      if (!sectionId) throw new Error('Missing section ID');
      const { data, error } = await getSectionResources(sectionId);
      if (error) throw error;
      return data;
    },
    enabled: !!sectionId,
    staleTime: 5 * 60 * 1000,
  });
};

export const resourceByIdKeys = {
  byId: (resourceId: string) => ['section-resources', 'by-id', resourceId] as const,
};

export const useSectionResourceById = (resourceId: string | undefined) => {
  return useQuery({
    queryKey: resourceByIdKeys.byId(resourceId || ''),
    queryFn: async () => {
      if (!resourceId) throw new Error('Missing resource ID');
      const { data, error } = await getSectionResourceById(resourceId);
      if (error) throw error;
      return data;
    },
    enabled: !!resourceId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUploadResource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, file, orderIndex, classroomId }: {
      sectionId: string;
      file: File;
      orderIndex: number;
      classroomId: string;
    }) => {
      const { data, error } = await uploadAndCreateResource(sectionId, file, orderIndex);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sectionId, classroomId }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.bySection(sectionId) });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const useCreateLinkResource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, title, url, orderIndex, classroomId }: {
      sectionId: string;
      title: string;
      url: string;
      orderIndex: number;
      classroomId: string;
    }) => {
      const { data, error } = await createLinkResource(sectionId, title, url, orderIndex);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sectionId, classroomId }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.bySection(sectionId) });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

export const useDeleteResource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ resourceId, filePath, sectionId, classroomId }: {
      resourceId: string;
      filePath?: string | null;
      sectionId: string;
      classroomId: string;
    }) => {
      const { error } = await deleteSectionResource(resourceId, filePath);
      if (error) throw error;
    },
    onSuccess: (_, { sectionId, classroomId }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.bySection(sectionId) });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      queryClient.invalidateQueries({ queryKey: moduleFlowKeys.all });
    },
  });
};

export const useCreateTextActivity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sectionId,
      classroomId,
      title,
      summary,
      body_text,
      status,
      orderIndex,
    }: {
      sectionId: string;
      classroomId: string;
      title: string;
      summary?: string | null;
      body_text?: string | null;
      status?: ActivityResourceStatus;
      orderIndex: number;
    }) => {
      const { data, error } = await createSectionResource({
        section_id: sectionId,
        title,
        resource_type: 'text',
        body_text: body_text ?? null,
        summary: summary ?? null,
        status: status ?? 'published',
        file_path: null,
        url: null,
        mime_type: null,
        file_size: null,
        order_index: orderIndex,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sectionId, classroomId }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.bySection(sectionId) });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

/** Combined lesson row: text and/or video (file or URL), or v1 lesson_content blocks. */
export const useCreateLessonActivity = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sectionId,
      classroomId,
      title,
      summary,
      body_text,
      lesson_content,
      status,
      orderIndex,
      url,
      file_path,
      mime_type,
      file_size,
    }: {
      sectionId: string;
      classroomId: string;
      title: string;
      summary?: string | null;
      body_text?: string | null;
      lesson_content?: LessonContentV1 | null;
      status?: ActivityResourceStatus;
      orderIndex: number;
      url?: string | null;
      file_path?: string | null;
      mime_type?: string | null;
      file_size?: number | null;
    }) => {
      const { data, error } = await createSectionResource({
        section_id: sectionId,
        title,
        resource_type: 'lesson',
        body_text: body_text ?? null,
        lesson_content: lesson_content ?? null,
        summary: summary ?? null,
        status: status ?? 'published',
        file_path: file_path ?? null,
        url: url ?? null,
        mime_type: mime_type ?? null,
        file_size: file_size ?? null,
        order_index: orderIndex,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (_, { sectionId, classroomId }) => {
      await queryClient.invalidateQueries({ queryKey: resourceKeys.bySection(sectionId) });
      await queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      await syncModuleFlowToResolvedDisplayForSection(queryClient, classroomId, sectionId);
    },
  });
};

export const useUpdateSectionResource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      resourceId,
      sectionId,
      classroomId,
      updates,
    }: {
      resourceId: string;
      sectionId: string;
      classroomId: string;
      updates: UpdateSectionResourceInput;
    }) => {
      const { data, error } = await updateSectionResource(resourceId, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sectionId, classroomId, resourceId }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.bySection(sectionId) });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
      queryClient.invalidateQueries({ queryKey: resourceByIdKeys.byId(resourceId) });
    },
  });
};

/** Video resource from an external URL (not file upload). */
export const useCreateVideoUrlResource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sectionId,
      classroomId,
      title,
      url,
      orderIndex,
    }: {
      sectionId: string;
      classroomId: string;
      title: string;
      url: string;
      orderIndex: number;
    }) => {
      const { data, error } = await createSectionResource({
        section_id: sectionId,
        title,
        resource_type: 'video',
        url,
        file_path: null,
        mime_type: null,
        file_size: null,
        order_index: orderIndex,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sectionId, classroomId }) => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.bySection(sectionId) });
      queryClient.invalidateQueries({ queryKey: syllabusKeys.byClassroom(classroomId) });
    },
  });
};

// ---------------------------------------------------------------------------
// Student Progress
// ---------------------------------------------------------------------------

export const progressKeys = {
  all: ['student-progress'] as const,
  bySyllabus: (syllabusId: string, studentId: string) =>
    [...progressKeys.all, syllabusId, studentId] as const,
};

export const useStudentProgress = (syllabusId: string | undefined, studentId: string | undefined) => {
  return useQuery({
    queryKey: progressKeys.bySyllabus(syllabusId || '', studentId || ''),
    queryFn: async () => {
      if (!syllabusId || !studentId) throw new Error('Missing IDs');
      const { data, error } = await getStudentProgress(syllabusId, studentId);
      if (error) throw error;
      return data;
    },
    enabled: !!syllabusId && !!studentId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useUpdateStudentProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, studentId, status, syllabusId }: {
      sectionId: string;
      studentId: string;
      status: StudentProgressStatus;
      syllabusId: string;
    }) => {
      const { data, error } = await upsertStudentProgress(sectionId, studentId, status);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { syllabusId, studentId }) => {
      queryClient.invalidateQueries({ queryKey: progressKeys.bySyllabus(syllabusId, studentId) });
    },
  });
};

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

export const changelogKeys = {
  all: ['syllabus-changelog'] as const,
  bySyllabus: (syllabusId: string) => [...changelogKeys.all, syllabusId] as const,
};

export const useChangelog = (syllabusId: string | undefined) => {
  return useQuery({
    queryKey: changelogKeys.bySyllabus(syllabusId || ''),
    queryFn: async () => {
      if (!syllabusId) throw new Error('Missing syllabus ID');
      const { data, error } = await getChangelog(syllabusId);
      if (error) throw error;
      return data;
    },
    enabled: !!syllabusId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useCreateChangelog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ syllabusId, changedBy, changeSummary, snapshot }: {
      syllabusId: string;
      changedBy: string;
      changeSummary: string;
      snapshot?: Record<string, unknown>;
    }) => {
      const { error } = await createChangelogEntry(syllabusId, changedBy, changeSummary, snapshot);
      if (error) throw error;
    },
    onSuccess: (_, { syllabusId }) => {
      queryClient.invalidateQueries({ queryKey: changelogKeys.bySyllabus(syllabusId) });
    },
  });
};

// ---------------------------------------------------------------------------
// Section Assignments
// ---------------------------------------------------------------------------

export const sectionAssignmentKeys = {
  all: ['section-assignments'] as const,
  bySection: (sectionId: string) => [...sectionAssignmentKeys.all, sectionId] as const,
};

export const useSectionAssignments = (sectionId: string | undefined) => {
  return useQuery({
    queryKey: sectionAssignmentKeys.bySection(sectionId || ''),
    queryFn: async () => {
      if (!sectionId) throw new Error('Missing section ID');
      const { data, error } = await getAssignmentsBySection(sectionId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!sectionId,
    staleTime: 2 * 60 * 1000,
  });
};

export const sectionProgressKeys = {
  all: ['section-assignment-progress'] as const,
  bySection: (sectionId: string, studentId: string) =>
    [...sectionProgressKeys.all, sectionId, studentId] as const,
};

export const useSectionAssignmentProgress = (sectionId: string | undefined, studentId: string | undefined) => {
  return useQuery({
    queryKey: sectionProgressKeys.bySection(sectionId || '', studentId || ''),
    queryFn: async () => {
      if (!sectionId || !studentId) throw new Error('Missing IDs');
      const { data, error } = await getSectionAssignmentProgress(sectionId, studentId);
      if (error) throw error;
      return data;
    },
    enabled: !!sectionId && !!studentId,
    staleTime: 60 * 1000,
  });
};

// ---------------------------------------------------------------------------
// Section Comments
// ---------------------------------------------------------------------------

export const commentKeys = {
  all: ['section-comments'] as const,
  bySection: (sectionId: string) => [...commentKeys.all, sectionId] as const,
};

export const useSectionComments = (sectionId: string | undefined) => {
  return useQuery({
    queryKey: commentKeys.bySection(sectionId || ''),
    queryFn: async () => {
      if (!sectionId) throw new Error('Missing section ID');
      const { data, error } = await getSectionComments(sectionId);
      if (error) throw error;
      return data;
    },
    enabled: !!sectionId,
    staleTime: 60 * 1000,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, userId, content, parentId }: {
      sectionId: string;
      userId: string;
      content: string;
      parentId?: string | null;
    }) => {
      const { data, error } = await createSectionComment(sectionId, userId, content, parentId);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { sectionId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.bySection(sectionId) });
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, sectionId }: { commentId: string; sectionId: string }) => {
      const { error } = await deleteSectionComment(commentId);
      if (error) throw error;
    },
    onSuccess: (_, { sectionId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.bySection(sectionId) });
    },
  });
};
