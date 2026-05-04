/**
 * Submission Service
 * Handles all submission-related operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
import type { Database } from '@/integrations/supabase/types';
import type {
  Submission,
  SubmissionWithDetails,
  AssignmentFeedback,
  ApiError,
  ChatRequest,
  ChatResponse,
  FeedbackRequest,
  FeedbackResponse,
  Message,
} from '@/types';
import { SUBMISSION_STATUS } from '@/config/constants';
import { createNotification } from '@/lib/notificationService';
import { rehydrateMessages } from '@/lib/conversationMessages';
import { createChatStreamEmission, hasConversationCompleteMarker } from '@/lib/chatDisplay';
import { canRetryAfterCompleting, canStartFirstAttempt } from '@/lib/assignmentAttemptPolicy';
import { resolveUserDisplayProfiles } from '@/lib/resolveUserDisplayProfiles';

export type StudentSubmissionContext = {
  submission: Submission | null;
  allAttempts: Submission[];
  canRetry: boolean;
};

async function insertSubmissionRow(
  assignmentId: string,
  studentId: string,
  attemptNumber: number,
  opts?: { isTeacherAttempt?: boolean },
): Promise<{ data: Submission | null; error: ApiError | null }> {
  const { data: newSubmission, error: createError } = await supabase
    .from('submissions')
    .insert([
      {
        assignment_id: assignmentId,
        student_id: studentId,
        attempt_number: attemptNumber,
        status: SUBMISSION_STATUS.IN_PROGRESS as any,
        ...(opts?.isTeacherAttempt ? { is_teacher_attempt: true } : {}),
      },
    ])
    .select()
    .single();

  if (createError) {
    return { data: null, error: handleSupabaseError(createError) };
  }

  return { data: newSubmission as any as Submission, error: null };
}

/**
 * Resolves which submission row the student should see and whether they may start a retry after completing.
 * Creates the first in-progress row when none exist (if policy allows).
 */
export const getStudentSubmissionContext = async (
  assignmentId: string,
  studentId: string,
  opts?: { isTeacherTry?: boolean },
): Promise<{ data: StudentSubmissionContext; error: ApiError | null }> => {
  try {
    const { data: assignment, error: assignErr } = await supabase
      .from('assignments')
      .select('id, attempt_mode, due_at, status')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignErr) {
      return {
        data: { submission: null, allAttempts: [], canRetry: false },
        error: handleSupabaseError(assignErr),
      };
    }
    if (!assignment) {
      return { data: { submission: null, allAttempts: [], canRetry: false }, error: null };
    }

    const { data: rows, error: rowsErr } = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .order('attempt_number', { ascending: true });

    if (rowsErr) {
      return {
        data: { submission: null, allAttempts: [], canRetry: false },
        error: handleSupabaseError(rowsErr),
      };
    }

    const list = (rows ?? []) as unknown as Submission[];
    const now = new Date();

    const inProgress = list.find((s) => s.status === SUBMISSION_STATUS.IN_PROGRESS);
    if (inProgress) {
      /** Teacher try can reuse an existing draft row missing is_teacher_attempt; align flag for RLS, feeds, and triggers. */
      if (
        opts?.isTeacherTry === true &&
        !(inProgress as { is_teacher_attempt?: boolean }).is_teacher_attempt
      ) {
        const { error: patchErr } = await supabase
          .from('submissions')
          .update({ is_teacher_attempt: true })
          .eq('id', inProgress.id);
        if (!patchErr) {
          (inProgress as { is_teacher_attempt?: boolean }).is_teacher_attempt = true;
        }
      }
      return {
        data: {
          submission: inProgress,
          allAttempts: list,
          canRetry: false,
        },
        error: null,
      };
    }

    if (list.length === 0) {
      const allowFirst =
        opts?.isTeacherTry === true || canStartFirstAttempt(assignment as any, now);
      if (!allowFirst) {
        return {
          data: { submission: null, allAttempts: [], canRetry: false },
          error: null,
        };
      }
      const { data: created, error: insErr } = await insertSubmissionRow(
        assignmentId,
        studentId,
        1,
        opts?.isTeacherTry ? { isTeacherAttempt: true } : undefined,
      );
      if (insErr || !created) {
        return { data: { submission: null, allAttempts: [], canRetry: false }, error: insErr };
      }
      return {
        data: { submission: created, allAttempts: [created], canRetry: false },
        error: null,
      };
    }

    const completed = list.filter((s) => s.status === SUBMISSION_STATUS.COMPLETED);
    let latestCompleted = [...completed].sort((a, b) => {
      const ta = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const tb = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return tb - ta;
    })[0];

    /** If rows exist but none matched `completed` (e.g. legacy status), still surface the latest attempt. */
    if (!latestCompleted && list.length > 0) {
      latestCompleted = [...list].sort(
        (a, b) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0),
      )[0];
    }

    const retry = canRetryAfterCompleting(assignment as any, now);
    return {
      data: {
        submission: latestCompleted ?? null,
        allAttempts: list,
        canRetry: retry,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: { submission: null, allAttempts: [], canRetry: false },
      error: handleSupabaseError(error),
    };
  }
};

export const startNewSubmissionAttempt = async (
  assignmentId: string,
  studentId: string,
  opts?: { isTeacherAttempt?: boolean },
): Promise<{ data: Submission | null; error: ApiError | null }> => {
  try {
    const { data: assignment, error: assignErr } = await supabase
      .from('assignments')
      .select('id, attempt_mode, due_at')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignErr) return { data: null, error: handleSupabaseError(assignErr) };
    if (!assignment) {
      return { data: null, error: { message: 'Assignment not found', code: 'NOT_FOUND' } };
    }

    const now = new Date();
    if (!canRetryAfterCompleting(assignment as any, now)) {
      return {
        data: null,
        error: {
          message: 'Another attempt is not allowed for this assignment.',
          code: 'ATTEMPT_NOT_ALLOWED',
        },
      };
    }

    const { data: rows, error: rowsErr } = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .order('attempt_number', { ascending: true });

    if (rowsErr) return { data: null, error: handleSupabaseError(rowsErr) };
    const list = (rows ?? []) as unknown as Submission[];
    if (list.some((s) => s.status === SUBMISSION_STATUS.IN_PROGRESS)) {
      return {
        data: null,
        error: { message: 'You already have a draft in progress.', code: 'DUPLICATE_DRAFT' },
      };
    }
    if (!list.some((s) => s.status === SUBMISSION_STATUS.COMPLETED)) {
      return {
        data: null,
        error: { message: 'Complete your current attempt first.', code: 'INVALID_STATE' },
      };
    }

    const nextNum = Math.max(...list.map((s) => s.attempt_number ?? 1)) + 1;
    return insertSubmissionRow(assignmentId, studentId, nextNum, {
      isTeacherAttempt: opts?.isTeacherAttempt,
    });
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/** @deprecated Prefer getStudentSubmissionContext */
export const getOrCreateSubmission = async (
  assignmentId: string,
  studentId: string,
  opts?: { isTeacherTry?: boolean },
): Promise<{ data: Submission | null; error: ApiError | null }> => {
  const { data, error } = await getStudentSubmissionContext(assignmentId, studentId, opts);
  if (error) return { data: null, error };
  return { data: data.submission, error: null };
};

/**
 * Get full submission details including assignment, student profile, feedback, and alerts
 */
export const getFullSubmissionDetails = async (
  submissionId: string
): Promise<{ data: any | null; error: ApiError | null }> => {
  try {
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select(`
        *,
        assignments(id, title, instructions, classroom_id, due_at, type, auto_publish_ai_feedback, student_facing_task, classrooms(name, teacher_id))
      `)
      .eq('id', submissionId)
      .single();

    if (subError) throw subError;
    if (!submission) return { data: null, error: null };

    const [
      { data: feedback },
      { data: alerts },
      profileMap,
    ] = await Promise.all([
      supabase
        .from('assignment_feedback')
        .select('*')
        .eq('submission_id', submissionId)
        .maybeSingle(),
      supabase
        .from('student_alerts')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false }),
      resolveUserDisplayProfiles(supabase, [(submission as { student_id: string }).student_id]),
    ]);

    const prof = profileMap.get((submission as { student_id: string }).student_id);

    return {
      data: {
        ...submission,
        student_profiles: prof
          ? { full_name: prof.full_name, avatar_url: prof.avatar_url }
          : null,
        student_name: prof?.full_name || '',
        student_avatar_url: prof?.avatar_url,
        feedback: feedback || null,
        alerts: alerts || [],
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Load chat messages for a submission (teacher or student; RLS applies).
 * Returns null when no conversation row or empty messages.
 */
export const getAssignmentConversationMessages = async (
  submissionId: string
): Promise<{ data: Message[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignment_conversations')
      .select('messages')
      .eq('submission_id', submissionId)
      .maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!data?.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      return { data: null, error: null };
    }

    const raw = data.messages as unknown as Message[];
    return { data: rehydrateMessages(raw), error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export type AssignmentChatSentenceFlag = Database['public']['Tables']['assignment_chat_sentence_flags']['Row'];

/**
 * Sentence flags reported by the student on assistant chat (teacher + student RLS).
 */
export const getAssignmentChatSentenceFlags = async (
  submissionId: string
): Promise<{ data: AssignmentChatSentenceFlag[] | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignment_chat_sentence_flags')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }
    return { data: data ?? [], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get all submissions for a classroom with full enrichment (profiles + feedback)
 */
export const getEnrichedClassroomSubmissions = async (
  classroomId: string
): Promise<{ data: any[] | null; error: ApiError | null }> => {
  try {
    // 1. Get all assignments in this classroom with their assigned student profile if any
    const { data: assignments, error: assignError } = await supabase
      .from('assignments')
      .select(
        'id, title, type, created_at, assigned_student_id, status, syllabus_section_id, student_profiles(user_id, full_name, avatar_url)',
      )
      .eq('classroom_id', classroomId);

    if (assignError) throw assignError;
    if (!assignments || assignments.length === 0) return { data: [], error: null };

    const assignmentIds = assignments.map((a) => a.id);

    // 2. Get all submissions with student profiles
    const { data: submissions, error: subError } = await supabase
      .from('submissions')
      .select(`
        id, 
        submitted_at, 
        student_id, 
        assignment_id, 
        status,
        attempt_number,
        conversation_complete_at_submit,
        is_teacher_attempt
      `)
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false });

    if (subError) throw subError;

    const profileByUserId = await resolveUserDisplayProfiles(
      supabase,
      (submissions || []).map((s) => s.student_id),
    );

    const submissionIds = (submissions || []).map((s) => s.id);

    // 3. Bulk fetch feedback
    const { data: feedback } = await supabase
      .from('assignment_feedback')
      .select('submission_id, teacher_feedback, conversation_context')
      .in('submission_id', submissionIds);

    // 4. Combine data
    const feedbackMap = new Map(feedback?.map((f) => [f.submission_id, f]) || []);
    const submissionMap = new Set(submissions?.map(s => `${s.assignment_id}-${s.student_id}`) || []);

    const enriched = (submissions || []).map((sub) => {
      const fb = feedbackMap.get(sub.id);
      const studentProfile = profileByUserId.get(sub.student_id);
      const assignment = assignments.find(a => a.id === sub.assignment_id);
      const assignmentType = (assignment as { type?: string } | undefined)?.type;

      return {
        ...sub,
        student_name: studentProfile?.full_name || 'Unknown',
        student_avatar_url: studentProfile?.avatar_url,
        assignment_title: assignment?.title || 'Unknown Assignment',
        assignment_type: assignmentType ?? null,
        syllabus_section_id: assignment?.syllabus_section_id ?? null,
        has_feedback: !!fb,
        teacher_feedback: fb?.teacher_feedback,
        conversation_context: (fb?.conversation_context as unknown as Message[]) || []
      };
    });

    // 5. Add pending assignments (assigned to specific students but not yet started)
    assignments.forEach(assign => {
      if (assign.status === 'published' && assign.assigned_student_id && !submissionMap.has(`${assign.id}-${assign.assigned_student_id}`)) {
        const profile = assign.student_profiles;
        const studentProfile = Array.isArray(profile) ? profile[0] : profile;

        if (studentProfile) {
          const pendingSub: any = {
            id: `pending-${assign.id}-${assign.assigned_student_id}`,
            submitted_at: assign.created_at,
            student_id: assign.assigned_student_id,
            assignment_id: assign.id,
            status: 'in_progress',
            student_name: studentProfile.full_name || 'Unknown',
            student_avatar_url: studentProfile.avatar_url,
            assignment_title: assign.title,
            assignment_type: (assign as { type?: string }).type ?? null,
            syllabus_section_id: assign.syllabus_section_id ?? null,
            has_feedback: false,
            teacher_feedback: null,
            conversation_context: [],
            is_teacher_attempt: false,
          };
          enriched.push(pendingSub);
        }
      }
    });

    // Sort by date (submitted_at or created_at for pending)
    enriched.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

    return { data: enriched, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get submission by ID
 */
export const getSubmissionById = async (
  submissionId: string
): Promise<{ data: SubmissionWithDetails | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(
        `
        *,
        assignments(title),
        assignment_feedback(student_feedback, teacher_feedback, created_at)
      `
      )
      .eq('id', submissionId)
      .maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    if (!data) {
      return { data: null, error: null };
    }

    const profileMap = await resolveUserDisplayProfiles(supabase, [
      (data as { student_id: string }).student_id,
    ]);
    const prof = profileMap.get((data as { student_id: string }).student_id);
    const merged = {
      ...data,
      student_profiles: prof
        ? {
            full_name: prof.full_name,
            avatar_url: prof.avatar_url,
            user_id: prof.user_id,
            created_at: null as string | null,
          }
        : null,
    };

    return { data: merged as any as SubmissionWithDetails, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get all submissions for a classroom
 */
export const getClassroomSubmissions = async (
  classroomId: string
): Promise<{ data: SubmissionWithDetails[] | null; error: ApiError | null }> => {
  try {
    const { data: assignments, error: assignError } = await supabase
      .from('assignments')
      .select('id')
      .eq('classroom_id', classroomId);

    if (assignError || !assignments || assignments.length === 0) {
      return { data: [], error: assignError ? handleSupabaseError(assignError) : null };
    }

    const assignmentIds = assignments.map((a) => a.id);

    const { data, error } = await supabase
      .from('submissions')
      .select(
        `
        *,
        assignments(title),
        assignment_feedback(student_feedback, teacher_feedback, created_at)
      `
      )
      .in('assignment_id', assignmentIds)
      .eq('status', SUBMISSION_STATUS.COMPLETED as any)
      .order('submitted_at', { ascending: false });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    const rows = data || [];
    const profileMap = await resolveUserDisplayProfiles(
      supabase,
      rows.map((r) => (r as { student_id: string }).student_id),
    );
    const merged = rows.map((r) => {
      const sid = (r as { student_id: string }).student_id;
      const prof = profileMap.get(sid);
      return {
        ...r,
        student_profiles: prof
          ? {
              full_name: prof.full_name,
              avatar_url: prof.avatar_url,
              user_id: prof.user_id,
              created_at: null as string | null,
            }
          : null,
      };
    });

    return { data: merged as any as SubmissionWithDetails[], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Get feedback for a submission
 */
export const getSubmissionFeedback = async (
  submissionId: string
): Promise<{ data: AssignmentFeedback | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase
      .from('assignment_feedback')
      .select('*')
      .eq('submission_id', submissionId)
      .maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data: data as unknown as AssignmentFeedback, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Send chat message to Perleap agent
 */
export const sendChatMessage = async (
  request: ChatRequest
): Promise<{ data: ChatResponse | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase.functions.invoke('perleap-chat', {
      body: request,
    });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Stream chat message from Perleap agent
 */
export const streamChatMessage = async (
  request: ChatRequest,
  onToken: (token: string) => void
): Promise<{
  data: { shouldEnd: boolean; debug?: ChatResponse['debug'] } | null;
  error: ApiError | null;
}> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/perleap-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream, application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ ...request, stream: true }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorPayload: unknown = null;
      try {
        errorPayload = JSON.parse(errorText) as unknown;
      } catch {
        errorPayload = null;
      }
      const errMsg =
        typeof errorPayload === 'object' &&
        errorPayload !== null &&
        'error' in errorPayload &&
        typeof (errorPayload as { error: unknown }).error === 'string'
          ? (errorPayload as { error: string }).error
          : errorText.slice(0, 500);
      throw new Error(errMsg || 'Failed to stream chat');
    }

    const contentType = response.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
      const parsed = (await response.json()) as ChatResponse;
      const msg = String(parsed.message ?? '');
      if (msg) {
        onToken(msg);
      }
      let shouldEnd = parsed.shouldEnd === true;
      if (!shouldEnd && msg) {
        const upper = msg.toUpperCase();
        const semanticPhrases = [
          'WE ARE DONE',
          'COMPLETED ALL THE TASKS',
          'FINISHED ALL THE TASKS',
          'COMPLETED THE ASSIGNMENT',
          'FINISHED THE ASSIGNMENT',
          'YOU HAVE COMPLETED ALL',
          "YOU'VE COMPLETED ALL",
          'SUCCESSFULLY ANSWERED ALL',
          'ACTIVITY IS COMPLETE',
          'YES, WE ARE DONE',
          "WE'VE ACTUALLY COMPLETED ALL",
          'JOB ON COMPLETING THE TASKS',
          'COMPLETING THE TASKS',
          'DONE WITH THE TASKS',
          'FINISHED THE TASKS',
          'FINISHED THE ACTIVITY',
          'COMPLETED THE ACTIVITY',
          'YOU HAVE FINISHED',
          "YOU'VE FINISHED",
          'ALL TASKS ARE COMPLETE',
          'סיימנו את המשימה',
          'השלמת את כל המשימות',
          'כל הכבוד על סיום המטלה',
          'סיימת את המטלה',
          'סיימת את הפעילות',
        ];
        shouldEnd =
          hasConversationCompleteMarker(msg) ||
          semanticPhrases.some((phrase) => upper.includes(phrase));
      }
      return { data: { shouldEnd, debug: parsed.debug }, error: null };
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    const emission = createChatStreamEmission();
    let endSignal = false;

    const track = (t: string) => {
      fullContent += t;
      onToken(t);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      
      // Multi-layered JSON Safety Filter:
      // Catch chunks that are pure JSON or contain JSON blocks
      if (chunk.trim().startsWith('{') || chunk.trim().includes('{"message":')) {
        try {
          // 1. Try direct parsing of the whole chunk
          const trimmed = chunk.trim();
          const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const potentialJson = jsonMatch[0];
            const parsed = JSON.parse(potentialJson);
            if (parsed.message) {
              const cleanMsg = String(parsed.message).replace(/\\n/g, '\n').replace(/\\"/g, '"');
              emission.feed(cleanMsg, track);
              continue;
            }
          }
          
          // 2. Regex fallback for specifically the message property
          const match = chunk.match(/"message"\s*:\s*"([^"]+)"/);
          if (match && match[1]) {
            const cleanMsg = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            emission.feed(cleanMsg, track);
            continue;
          }
        } catch (e) {
          // Not valid JSON or parsing failed, continue as normal
        }
      }
      
      if (chunk.includes('__CONVERSATION_END__')) {
        endSignal = true;
        const cleanChunk = chunk.replace('__CONVERSATION_END__', '');
        if (cleanChunk) {
          emission.feed(cleanChunk, track);
        }
      } else {
        emission.feed(chunk, track);
      }
    }

    emission.end(track);

    const upperContent = fullContent.toUpperCase();
    let shouldEnd = endSignal || emission.getShouldEnd() || hasConversationCompleteMarker(fullContent);

    if (!shouldEnd) {
      const semanticPhrases = [
        'WE ARE DONE',
        'COMPLETED ALL THE TASKS',
        'FINISHED ALL THE TASKS',
        'COMPLETED THE ASSIGNMENT',
        'FINISHED THE ASSIGNMENT',
        'YOU HAVE COMPLETED ALL',
        'YOU\'VE COMPLETED ALL',
        'SUCCESSFULLY ANSWERED ALL',
        'ACTIVITY IS COMPLETE',
        'YES, WE ARE DONE',
        'WE\'VE ACTUALLY COMPLETED ALL',
        'JOB ON COMPLETING THE TASKS',
        'COMPLETING THE TASKS',
        'DONE WITH THE TASKS',
        'FINISHED THE TASKS',
        'FINISHED THE ACTIVITY',
        'COMPLETED THE ACTIVITY',
        'YOU HAVE FINISHED',
        'YOU\'VE FINISHED',
        'ALL TASKS ARE COMPLETE',
        'סיימנו את המשימה',
        'השלמת את כל המשימות',
        'כל הכבוד על סיום המטלה',
        'סיימת את המטלה',
        'סיימת את הפעילות'
      ];
      shouldEnd = semanticPhrases.some(phrase => upperContent.includes(phrase));
    }

    return { data: { shouldEnd, debug: undefined }, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Generate feedback for a completed submission
 */
export const generateFeedback = async (
  request: FeedbackRequest
): Promise<{ data: FeedbackResponse | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase.functions.invoke('generate-feedback', {
      body: request,
    });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

/**
 * Mark submission as completed
 */
export const completeSubmission = async (
  submissionId: string,
  options?: {
    awaitingTeacherFeedbackRelease?: boolean;
    /** Chat-primary: true if conversation had ended (green banner) at submit; false if early. Omit to leave column unchanged. */
    conversationCompleteAtSubmit?: boolean | null;
  },
): Promise<{ success: boolean; error: ApiError | null }> => {
  try {
    const update: Database['public']['Tables']['submissions']['Update'] = {
      status: SUBMISSION_STATUS.COMPLETED,
      submitted_at: new Date().toISOString(),
    };
    if (options?.awaitingTeacherFeedbackRelease) {
      update.awaiting_teacher_feedback_release = true;
    }
    if (options && 'conversationCompleteAtSubmit' in options) {
      update.conversation_complete_at_submit = options.conversationCompleteAtSubmit ?? null;
    }

    const { error } = await supabase.from('submissions').update(update).eq('id', submissionId);

    if (error) {
      return { success: false, error: handleSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) };
  }
};

function normalizeFeedbackString(s: string | null | undefined): string {
  return (s ?? '').trim();
}

/**
 * Teacher edits stored feedback text before publishing to the student.
 */
export const updateAssignmentFeedbackText = async (params: {
  submissionId: string;
  teacher_feedback?: string | null;
  student_feedback?: string | null;
  /** When feedback was already published to the student and text changes, insert a student notification. */
  editNotification?: {
    studentId: string;
    assignmentId: string;
    assignmentTitle: string;
    teacherId: string | null;
    title: string;
    message: string;
    previousTeacher: string | null;
    previousStudent: string | null;
    shouldNotify: boolean;
  };
}): Promise<{ success: boolean; error: ApiError | null }> => {
  try {
    const { submissionId, teacher_feedback, student_feedback, editNotification } = params;
    const payload: Pick<
      Database['public']['Tables']['assignment_feedback']['Update'],
      'teacher_feedback' | 'student_feedback'
    > = {};
    if (teacher_feedback !== undefined) payload.teacher_feedback = teacher_feedback;
    if (student_feedback !== undefined) payload.student_feedback = student_feedback;
    if (Object.keys(payload).length === 0) {
      return { success: true, error: null };
    }

    const { error } = await supabase
      .from('assignment_feedback')
      .update(payload)
      .eq('submission_id', submissionId);

    if (error) {
      return { success: false, error: handleSupabaseError(error) };
    }

    if (editNotification?.shouldNotify) {
      const n = editNotification;
      const tf = teacher_feedback;
      const sf = student_feedback;
      let textChanged = false;
      if (tf !== undefined && normalizeFeedbackString(tf) !== normalizeFeedbackString(n.previousTeacher)) {
        textChanged = true;
      }
      if (sf !== undefined && normalizeFeedbackString(sf) !== normalizeFeedbackString(n.previousStudent)) {
        textChanged = true;
      }
      if (textChanged) {
        try {
          await createNotification(
            n.studentId,
            'feedback_updated',
            n.title,
            n.message,
            `/student/assignment/${n.assignmentId}`,
            {
              assignment_id: n.assignmentId,
              assignment_title: n.assignmentTitle,
              submission_id: submissionId,
              feedback_updated: true,
            },
            n.teacherId ?? undefined,
          );
        } catch (notifErr) {
          return { success: false, error: handleSupabaseError(notifErr) };
        }
      }
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) };
  }
};

/**
 * Teacher releases AI feedback to the student (when assignment uses teacher approval gate).
 */
export const releaseAiFeedbackToStudent = async (params: {
  submissionId: string;
  studentId: string;
  assignmentId: string;
  assignmentTitle: string;
  teacherId: string | null;
}): Promise<{ success: boolean; error: ApiError | null }> => {
  try {
    const { submissionId } = params;

    const { error: fbErr } = await supabase
      .from('assignment_feedback')
      .update({ visible_to_student: true })
      .eq('submission_id', submissionId);

    if (fbErr) {
      return { success: false, error: handleSupabaseError(fbErr) };
    }

    const { error: subErr } = await supabase
      .from('submissions')
      .update({ awaiting_teacher_feedback_release: false })
      .eq('id', submissionId);

    if (subErr) {
      return { success: false, error: handleSupabaseError(subErr) };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) };
  }
};

export type SubmissionTeacherPrivateNoteEntry = {
  id: string;
  submission_id: string;
  body: string;
  created_at: string;
  created_by: string | null;
};

export const listSubmissionTeacherPrivateNoteEntries = async (
  submissionId: string,
): Promise<{
  data: SubmissionTeacherPrivateNoteEntry[] | null;
  error: ApiError | null;
}> => {
  try {
    const { data, error } = await supabase
      .from('submission_teacher_private_note_entries')
      .select('id, submission_id, body, created_at, created_by')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: (data as SubmissionTeacherPrivateNoteEntry[]) ?? [], error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};

export const createSubmissionTeacherPrivateNoteEntry = async (params: {
  submissionId: string;
  body: string;
  userId: string;
}): Promise<{ success: boolean; error: ApiError | null }> => {
  try {
    const { error } = await supabase.from('submission_teacher_private_note_entries').insert({
      submission_id: params.submissionId,
      body: params.body,
      created_by: params.userId,
    });
    if (error) return { success: false, error: handleSupabaseError(error) };
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) };
  }
};

/** Teacher or app admin: insert a new in_progress attempt; prior submission rows stay. */
export const teacherResetStudentAssignmentProgress = async (
  submissionId: string,
): Promise<{ data: string | null; error: ApiError | null }> => {
  try {
    const { data, error } = await supabase.rpc('teacher_reset_student_assignment_progress', {
      _submission_id: submissionId,
    });
    if (error) return { data: null, error: handleSupabaseError(error) };
    return { data: typeof data === 'string' ? data : null, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
};
