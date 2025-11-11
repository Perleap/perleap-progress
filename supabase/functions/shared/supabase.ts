/**
 * Supabase Client Helpers
 * Shared utilities for Supabase operations in edge functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import type { SupabaseConfig, Message } from './types.ts';

/**
 * Get Supabase configuration from environment
 */
export const getSupabaseConfig = (): SupabaseConfig => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase configuration missing');
  }

  return { url, serviceRoleKey };
};

/**
 * Create Supabase client with service role
 */
export const createSupabaseClient = () => {
  const config = getSupabaseConfig();
  return createClient(config.url, config.serviceRoleKey);
};

/**
 * Fetch teacher name by assignment ID
 */
export const getTeacherNameByAssignment = async (
  assignmentId: string,
): Promise<string> => {
  const supabase = createSupabaseClient();

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('assignments')
    .select('classroom_id, classrooms(teacher_id)')
    .eq('id', assignmentId)
    .single();

  if (assignmentError || !assignmentData) {
    return 'your teacher';
  }

  if (assignmentData?.classrooms?.teacher_id) {
    const { data: teacherProfile } = await supabase
      .from('teacher_profiles')
      .select('full_name')
      .eq('user_id', assignmentData.classrooms.teacher_id)
      .maybeSingle();

    if (teacherProfile?.full_name) {
      return teacherProfile.full_name;
    }
  }

  return 'your teacher';
};

/**
 * Fetch student name by user ID
 */
export const getStudentName = async (studentId: string): Promise<string> => {
  const supabase = createSupabaseClient();

  const { data: studentProfile } = await supabase
    .from('student_profiles')
    .select('full_name')
    .eq('user_id', studentId)
    .maybeSingle();

  return studentProfile?.full_name || 'the student';
};

/**
 * Get or create conversation
 */
export const getOrCreateConversation = async (
  submissionId: string,
): Promise<{ id: string; messages: Message[] }> => {
  const supabase = createSupabaseClient();

  const { data: conversations, error: convError } = await supabase
    .from('assignment_conversations')
    .select('*')
    .eq('submission_id', submissionId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (convError) {
    throw new Error(`Error fetching conversation: ${convError.message}`);
  }

  if (conversations && conversations.length > 0) {
    return {
      id: conversations[0].id,
      messages: conversations[0].messages || [],
    };
  }

  return {
    id: '',
    messages: [],
  };
};

/**
 * Save conversation messages
 */
export const saveConversation = async (
  conversationId: string,
  submissionId: string,
  studentId: string,
  assignmentId: string,
  messages: Message[],
): Promise<void> => {
  const supabase = createSupabaseClient();

  if (conversationId) {
    await supabase
      .from('assignment_conversations')
      .update({ messages, updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  } else {
    await supabase.from('assignment_conversations').insert({
      submission_id: submissionId,
      student_id: studentId,
      assignment_id: assignmentId,
      messages,
    });
  }
};

/**
 * Fetch full teacher profile with teaching style data
 */
export const getTeacherProfile = async (teacherId: string) => {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('teacher_profiles')
    .select('*')
    .eq('user_id', teacherId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
};

/**
 * Fetch full student profile with learning preferences
 */
export const getStudentProfile = async (studentId: string) => {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', studentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
};

/**
 * Fetch assignment details including hard_skills, domain, and materials
 */
export const getAssignmentDetails = async (assignmentId: string) => {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('assignments')
    .select('hard_skills, hard_skill_domain, materials, instructions, classroom_id')
    .eq('id', assignmentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
};

/**
 * Fetch classroom resources (course-level materials)
 */
export const getClassroomResources = async (classroomId: string) => {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('classrooms')
    .select('resources, course_outline')
    .eq('id', classroomId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
};

/**
 * Get teacher ID from assignment ID
 */
export const getTeacherIdFromAssignment = async (
  assignmentId: string,
): Promise<string | null> => {
  const supabase = createSupabaseClient();

  const { data: assignmentData, error: assignmentError } = await supabase
    .from('assignments')
    .select('classroom_id, classrooms(teacher_id)')
    .eq('id', assignmentId)
    .single();

  if (assignmentError || !assignmentData) {
    return null;
  }

  return (assignmentData?.classrooms as any)?.teacher_id || null;
};

