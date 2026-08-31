import { getTeacherClassrooms } from './classroomService';
import { supabase, handleSupabaseError } from '@/api/client';

export type PlannerClassroom = {
  id: string;
  name: string;
};

export type PlannerAssignmentRow = {
  id: string;
  title: string;
  due_at: string;
  classroom_id: string;
  status: string;
  instructions: string;
  type: string;
};

export async function fetchPlannerClassrooms(
  teacherId: string,
  isAppAdmin: boolean
): Promise<PlannerClassroom[]> {
  const { data, error } = await getTeacherClassrooms(teacherId, {
    allClassroomsForAdmin: isAppAdmin,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((classroom) => ({
    id: classroom.id,
    name: classroom.name,
  }));
}

export async function fetchPlannerAssignments(
  classroomIds: string[]
): Promise<PlannerAssignmentRow[]> {
  if (classroomIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('assignments')
    .select('id, title, due_at, classroom_id, status, instructions, type')
    .in('classroom_id', classroomIds)
    .eq('active', true);

  if (error) {
    throw handleSupabaseError(error);
  }

  return (data ?? []) as PlannerAssignmentRow[];
}
