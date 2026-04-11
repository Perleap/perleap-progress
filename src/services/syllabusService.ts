/**
 * Syllabus Service
 * Handles all syllabus-related Supabase operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type { ApiError } from '@/types';
import type {
  Syllabus,
  SyllabusSection,
  GradingCategory,
  SyllabusWithSections,
  CreateSyllabusInput,
  UpdateSyllabusInput,
  CreateSyllabusSectionInput,
  UpdateSyllabusSectionInput,
  CreateGradingCategoryInput,
  UpdateGradingCategoryInput,
} from '@/types/syllabus';

// ---------------------------------------------------------------------------
// Syllabus
// ---------------------------------------------------------------------------

export const getSyllabusByClassroom = async (
  classroomId: string
): Promise<{ data: SyllabusWithSections | null; error: ApiError | null }> => {
  try {
    const { data: syllabus, error: syllabusError } = await supabase
      .from('syllabi' as any)
      .select('*')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (syllabusError) return { data: null, error: handleSupabaseError(syllabusError) };
    if (!syllabus) return { data: null, error: null };

    const { data: sections, error: sectionsError } = await supabase
      .from('syllabus_sections' as any)
      .select('*')
      .eq('syllabus_id', (syllabus as any).id)
      .order('order_index', { ascending: true });

    if (sectionsError) return { data: null, error: handleSupabaseError(sectionsError) };

    const { data: gradingCategories, error: gradingError } = await supabase
      .from('grading_categories' as any)
      .select('*')
      .eq('syllabus_id', (syllabus as any).id)
      .order('created_at', { ascending: true });

    if (gradingError) return { data: null, error: handleSupabaseError(gradingError) };

    return {
      data: {
        ...(syllabus as any),
        sections: (sections as any[]) || [],
        grading_categories: (gradingCategories as any[]) || [],
      } as SyllabusWithSections,
      error: null,
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const createSyllabus = async (
  input: CreateSyllabusInput
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('syllabi' as any)
      .insert([input] as any)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as Syllabus, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const updateSyllabus = async (
  syllabusId: string,
  updates: UpdateSyllabusInput
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('syllabi' as any)
      .update(updates as any)
      .eq('id', syllabusId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as Syllabus, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const publishSyllabus = async (
  syllabusId: string
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  return updateSyllabus(syllabusId, {
    status: 'published',
    published_at: new Date().toISOString(),
  });
};

export const archiveSyllabus = async (
  syllabusId: string
): Promise<{ data: Syllabus | null; error: ApiError | null }> => {
  return updateSyllabus(syllabusId, { status: 'archived' });
};

// ---------------------------------------------------------------------------
// Syllabus Sections
// ---------------------------------------------------------------------------

export const createSyllabusSection = async (
  input: CreateSyllabusSectionInput
): Promise<{ data: SyllabusSection | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('syllabus_sections' as any)
      .insert([input] as any)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as SyllabusSection, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const updateSyllabusSection = async (
  sectionId: string,
  updates: UpdateSyllabusSectionInput
): Promise<{ data: SyllabusSection | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('syllabus_sections' as any)
      .update(updates as any)
      .eq('id', sectionId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as SyllabusSection, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const deleteSyllabusSection = async (
  sectionId: string
): Promise<{ error: ApiError | null }> => {
  try {
    const { error } = await supabase
      .from('syllabus_sections' as any)
      .delete()
      .eq('id', sectionId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

export const reorderSyllabusSections = async (
  syllabusId: string,
  orderedIds: string[]
): Promise<{ error: ApiError | null }> => {
  try {
    // Run updates sequentially to maintain consistency on partial failure
    for (let index = 0; index < orderedIds.length; index++) {
      const { error } = await supabase
        .from('syllabus_sections' as any)
        .update({ order_index: index } as any)
        .eq('id', orderedIds[index])
        .eq('syllabus_id', syllabusId);

      if (error) {
        return { error: handleSupabaseError(error) };
      }
    }

    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

// ---------------------------------------------------------------------------
// Grading Categories
// ---------------------------------------------------------------------------

export const createGradingCategory = async (
  input: CreateGradingCategoryInput
): Promise<{ data: GradingCategory | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('grading_categories' as any)
      .insert([input] as any)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as GradingCategory, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const updateGradingCategory = async (
  categoryId: string,
  updates: UpdateGradingCategoryInput
): Promise<{ data: GradingCategory | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('grading_categories' as any)
      .update(updates as any)
      .eq('id', categoryId)
      .select()
      .single();

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data as any as GradingCategory, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const deleteGradingCategory = async (
  categoryId: string
): Promise<{ error: ApiError | null }> => {
  try {
    const { error } = await supabase
      .from('grading_categories' as any)
      .delete()
      .eq('id', categoryId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

// ---------------------------------------------------------------------------
// Assignment Linking
// ---------------------------------------------------------------------------

export const linkAssignmentToSection = async (
  assignmentId: string,
  sectionId: string,
  gradingCategoryId?: string | null
): Promise<{ error: ApiError | null }> => {
  try {
    const updates: Record<string, unknown> = { syllabus_section_id: sectionId };
    if (gradingCategoryId !== undefined) {
      updates.grading_category_id = gradingCategoryId;
    }
    const { error } = await supabase
      .from('assignments')
      .update(updates)
      .eq('id', assignmentId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

export const unlinkAssignmentFromSection = async (
  assignmentId: string
): Promise<{ error: ApiError | null }> => {
  try {
    const { error } = await supabase
      .from('assignments')
      .update({ syllabus_section_id: null, grading_category_id: null })
      .eq('id', assignmentId);

    if (error) return { error: handleSupabaseError(error) };
    return { error: null };
  } catch (error) {
    return { error: handleSupabaseError(error) };
  }
};

export const getAssignmentsBySection = async (
  sectionId: string
): Promise<{ data: any[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('id, title, type, status, due_at, syllabus_section_id, grading_category_id')
      .eq('syllabus_section_id', sectionId)
      .order('due_at', { ascending: true });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: data || [], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};
