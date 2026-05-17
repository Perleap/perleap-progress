/**
 * Supabase Client Helpers
 * Shared utilities for Supabase operations in edge functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';
import type { SupabaseConfig, Message } from './types.ts';
import { buildModuleActivityContextBundle } from '../_shared/assignmentContext.ts';

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
 * Plain-text bundle of linked module activities for AI prompts (chat, feedback).
 */
export const getAssignmentModuleActivityContextText = async (
  assignmentId: string,
): Promise<string> => {
  const supabase = createSupabaseClient();

  const { data: links, error } = await supabase
    .from('assignment_module_activities')
    .select('activity_list_id, order_index, include_in_ai_context')
    .eq('assignment_id', assignmentId)
    .order('order_index', { ascending: true });

  if (error || !links?.length) {
    return '';
  }

  const ids = [...new Set((links as { activity_list_id: string }[]).map((l) => l.activity_list_id))];
  const { data: resources, error: resErr } = await supabase
    .from('activity_list')
    .select('id, title, resource_type, url, body_text, summary, status, lesson_content')
    .in('id', ids)
    .eq('active', true);

  if (resErr || !resources?.length) {
    return '';
  }

  const map = new Map(
    (resources as Record<string, unknown>[]).map((r) => [r.id as string, r as any]),
  );
  const { text } = buildModuleActivityContextBundle(links as any, map);
  return text;
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

/** True if user is in public.app_admins (service-role client; used from Edge Functions). */
export const isAppAdmin = async (userId: string): Promise<boolean> => {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.rpc('is_app_admin', { _user_id: userId });
  if (error) {
    console.error('is_app_admin rpc', error);
    return false;
  }
  return data === true;
};

/** Max prior submissions merged from unit (syllabus section) + client chain (ordered, deduped). */
const UNIT_PRIOR_SUBMISSION_CAP = 15;

/**
 * Completed learner submissions in the same syllabus section + classroom (excluding current assignment),
 * one row per assignment (latest completion), ordered oldest → newest by submitted_at.
 */
export async function getPriorSubmissionIdsInSameSection(
  studentId: string,
  currentAssignmentId: string,
): Promise<string[]> {
  const supabase = createSupabaseClient();

  const { data: curr, error: e0 } = await supabase
    .from('assignments')
    .select('classroom_id, syllabus_section_id')
    .eq('id', currentAssignmentId)
    .maybeSingle();
  if (e0 || !curr?.classroom_id || !curr.syllabus_section_id) {
    return [];
  }

  const { data: sectionAssignments, error: e1 } = await supabase
    .from('assignments')
    .select('id')
    .eq('classroom_id', curr.classroom_id)
    .eq('syllabus_section_id', curr.syllabus_section_id)
    .neq('id', currentAssignmentId);
  if (e1 || !sectionAssignments?.length) return [];

  const assignmentIds = sectionAssignments.map((a) => a.id);
  const { data: subs, error: e2 } = await supabase
    .from('submissions')
    .select('id, assignment_id, submitted_at')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .eq('is_teacher_attempt', false)
    .in('assignment_id', assignmentIds)
    .order('submitted_at', { ascending: false });

  if (e2 || !subs?.length) return [];

  const latestByAssignment = new Map<string, { id: string; submitted_at: string }>();
  for (const s of subs) {
    const prev = latestByAssignment.get(s.assignment_id);
    if (!prev || String(s.submitted_at) > String(prev.submitted_at)) {
      latestByAssignment.set(s.assignment_id, { id: s.id, submitted_at: String(s.submitted_at) });
    }
  }
  const ordered = [...latestByAssignment.values()].sort((a, b) =>
    a.submitted_at.localeCompare(b.submitted_at),
  );
  let ids = ordered.map((x) => x.id);
  if (ids.length > UNIT_PRIOR_SUBMISSION_CAP) {
    ids = ids.slice(-UNIT_PRIOR_SUBMISSION_CAP);
  }
  return ids;
}

const PRIOR_CONTEXT_MAX_CHARS = 8000;

function stripChatContentForPriorContext(raw: string): string {
  let s = String(raw ?? '').replace(/\r\n/g, '\n');
  s = s.replace(/\[File:\s*[^\]]+\]\s*URL:\s*https?:\/\/\S+/gi, '[attachment]');
  return s.trim();
}

function formatMessagesForPriorContext(messages: Message[]): string {
  const parts: string[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    if (typeof m.content !== 'string') continue;
    const text = stripChatContentForPriorContext(m.content);
    if (!text) continue;
    const label = m.role === 'user' ? 'Student' : 'Assistant';
    const piece = `${label}: ${text}\n\n`;
    if (total + piece.length > PRIOR_CONTEXT_MAX_CHARS) break;
    parts.push(piece);
    total += piece.length;
  }
  return parts.reverse().join('').trim();
}

/**
 * Returns bounded plain-text context from a prior submission: Perleap chat transcript,
 * submission text_body, and/or free-text test answers — after validating same student + classroom.
 */
export const getValidatedPriorAssignmentChatExcerpt = async (
  priorSubmissionId: string,
  studentId: string,
  currentAssignmentId: string,
): Promise<string | null> => {
  const supabase = createSupabaseClient();

  const { data: priorSub, error: e1 } = await supabase
    .from('submissions')
    .select('student_id, assignment_id, text_body')
    .eq('id', priorSubmissionId)
    .maybeSingle();
  if (e1 || !priorSub) return null;
  if (priorSub.student_id !== studentId) return null;
  if (priorSub.assignment_id === currentAssignmentId) return null;

  const { data: priorClassRow, error: e2 } = await supabase
    .from('assignments')
    .select('classroom_id')
    .eq('id', priorSub.assignment_id)
    .maybeSingle();
  const { data: currClassRow, error: e3 } = await supabase
    .from('assignments')
    .select('classroom_id')
    .eq('id', currentAssignmentId)
    .maybeSingle();
  if (e2 || e3 || !priorClassRow || !currClassRow) return null;
  if (priorClassRow.classroom_id !== currClassRow.classroom_id) return null;

  let chatExcerpt = '';
  const { data: convRows, error: e4 } = await supabase
    .from('assignment_conversations')
    .select('messages')
    .eq('submission_id', priorSubmissionId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!e4 && convRows?.length) {
    const raw = convRows[0].messages;
    if (Array.isArray(raw) && raw.length > 0) {
      chatExcerpt = formatMessagesForPriorContext(raw as Message[]) || '';
    }
  }

  const sections: string[] = [];
  if (chatExcerpt.trim()) sections.push(chatExcerpt.trim());

  const tb = typeof priorSub.text_body === 'string' ? priorSub.text_body.trim() : '';
  if (tb) {
    const cleaned = stripChatContentForPriorContext(tb).slice(0, 4000);
    if (cleaned) {
      sections.push(`Submitted written work (prior assignment):\n${cleaned}`);
    }
  }

  const { data: testRows, error: eTr } = await supabase
    .from('test_responses')
    .select('question_id, selected_option_id, text_answer')
    .eq('submission_id', priorSubmissionId);

  if (!eTr && testRows?.length) {
    const qids = [...new Set(testRows.map((r) => r.question_id))];
    const { data: questions, error: eQ } =
      qids.length > 0
        ? await supabase
            .from('test_questions')
            .select('id, question_text, options')
            .in('id', qids)
        : { data: [] as { id: string; question_text: string; options: unknown }[], error: null };

    const qmap = new Map((questions ?? []).map((q) => [q.id, q]));

    const testLines: string[] = [];
    for (const tr of testRows) {
      const q = qmap.get(tr.question_id);
      const qtext = (q?.question_text ?? 'Question').trim();
      const ta = typeof tr.text_answer === 'string' ? tr.text_answer.trim() : '';
      if (ta) {
        testLines.push(`${qtext}\nAnswer: ${stripChatContentForPriorContext(ta)}`);
        continue;
      }
      const optIdRaw = tr.selected_option_id;
      const optId = optIdRaw != null && optIdRaw !== '' ? String(optIdRaw).trim() : '';
      if (!optId) continue;

      let label = '';
      if (q?.options && Array.isArray(q.options)) {
        const opts = q.options as { id?: unknown; text?: unknown }[];
        const opt = opts.find((o) => String(o?.id ?? '') === optId);
        label = typeof opt?.text === 'string' ? opt.text.trim() : '';
      }
      if (label) {
        testLines.push(`${qtext}\nSelected: ${stripChatContentForPriorContext(label)}`);
      } else {
        testLines.push(`${qtext}\nSelected: (multiple-choice; stored option id: ${optId})`);
      }
    }

    if (testLines.length > 0) {
      sections.push(
        `Prior assignment test responses:\n${testLines.join('\n\n')}`.slice(0, 4000),
      );
    }
  }

  if (sections.length === 0) return null;

  let out = sections.join('\n\n---\n\n');
  if (out.length > PRIOR_CONTEXT_MAX_CHARS) {
    out = out.slice(out.length - PRIOR_CONTEXT_MAX_CHARS);
  }
  return out.trim() || null;
};

