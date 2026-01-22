/**
 * Submission Service
 * Handles all submission-related operations
 */

import { supabase, handleSupabaseError } from '@/api/client';
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

/**
 * Get or create submission for a student and assignment
 */
export const getOrCreateSubmission = async (
  assignmentId: string,
  studentId: string
): Promise<{ data: Submission | null; error: ApiError | null }> => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (fetchError) {
      return { data: null, error: handleSupabaseError(fetchError) };
    }

    if (existing) {
      return { data: existing as any as Submission, error: null };
    }

    const { data: newSubmission, error: createError } = await supabase
      .from('submissions')
      .insert([
        {
          assignment_id: assignmentId,
          student_id: studentId,
          status: SUBMISSION_STATUS.IN_PROGRESS as any,
        },
      ])
      .select()
      .single();

    if (createError) {
      return { data: null, error: handleSupabaseError(createError) };
    }

    return { data: newSubmission as any as Submission, error: null };
  } catch (error) {
    return { data: null, error: handleSupabaseError(error) };
  }
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
        assignments(title, instructions, classroom_id, due_at, classrooms(name, teacher_id)),
        student_profiles(full_name, avatar_url)
      `)
      .eq('id', submissionId)
      .single();

    if (subError) throw subError;
    if (!submission) return { data: null, error: null };

    const [
      { data: feedback },
      { data: alerts }
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
        .order('created_at', { ascending: false })
    ]);

    const studentProfile = (submission as any).student_profiles;
    const studentName = Array.isArray(studentProfile)
      ? studentProfile[0]?.full_name
      : studentProfile?.full_name;

    return {
      data: {
        ...submission,
        student_name: studentName || '',
        student_avatar_url: Array.isArray(studentProfile) 
          ? studentProfile[0]?.avatar_url 
          : studentProfile?.avatar_url,
        feedback: feedback || null,
        alerts: alerts || []
      },
      error: null
    };
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
      .select('id, title, created_at, assigned_student_id, status, student_profiles(user_id, full_name, avatar_url)')
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
        student_profiles(user_id, full_name, avatar_url)
      `)
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false });

    if (subError) throw subError;

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
      const studentProfile = (sub as any).student_profiles;
      const assignment = assignments.find(a => a.id === sub.assignment_id);
      
      return {
        ...sub,
        student_name: studentProfile?.full_name || 'Unknown',
        student_avatar_url: studentProfile?.avatar_url,
        assignment_title: assignment?.title || 'Unknown Assignment',
        has_feedback: !!fb,
        teacher_feedback: fb?.teacher_feedback,
        conversation_context: (fb?.conversation_context as unknown as Message[]) || []
      };
    });

    // 5. Add pending assignments (assigned to specific students but not yet started)
    assignments.forEach(assign => {
      if (assign.status === 'published' && assign.assigned_student_id && !submissionMap.has(`${assign.id}-${assign.assigned_student_id}`)) {
        const profile = (assign as any).student_profiles;
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
            has_feedback: false,
            teacher_feedback: null,
            conversation_context: []
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
        student_profiles(full_name, avatar_url, user_id, created_at),
        assignment_feedback(student_feedback, teacher_feedback, created_at)
      `
      )
      .eq('id', submissionId)
      .maybeSingle();

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data: data as any as SubmissionWithDetails, error: null };
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
        student_profiles(full_name, avatar_url, user_id, created_at),
        assignment_feedback(student_feedback, teacher_feedback, created_at)
      `
      )
      .in('assignment_id', assignmentIds)
      .eq('status', SUBMISSION_STATUS.COMPLETED as any)
      .order('submitted_at', { ascending: false });

    if (error) {
      return { data: null, error: handleSupabaseError(error) };
    }

    return { data: data as any as SubmissionWithDetails[], error: null };
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
): Promise<{ data: { shouldEnd: boolean } | null; error: ApiError | null }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No active session');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/perleap-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ ...request, stream: true }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to stream chat');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let shouldEnd = false;

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
              fullContent += cleanMsg;
              onToken(cleanMsg);
              continue;
            }
          }
          
          // 2. Regex fallback for specifically the message property
          const match = chunk.match(/"message"\s*:\s*"([^"]+)"/);
          if (match && match[1]) {
            const cleanMsg = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            fullContent += cleanMsg;
            onToken(cleanMsg);
            continue;
          }
        } catch (e) {
          // Not valid JSON or parsing failed, continue as normal
        }
      }
      
      // Filter out the end-of-conversation signal from the visible stream
      if (chunk.includes('__CONVERSATION_END__')) {
        shouldEnd = true;
        const cleanChunk = chunk.replace('__CONVERSATION_END__', '');
        if (cleanChunk) {
          fullContent += cleanChunk;
          onToken(cleanChunk);
        }
      } else {
        fullContent += chunk;
        onToken(chunk);
      }
    }

    // Check for conversation completion marker if hidden signal wasn't caught
    if (!shouldEnd) {
      const completionMarker = '[CONVERSATION_COMPLETE]';
      const upperContent = fullContent.toUpperCase();
      
      // Technical marker check
      shouldEnd = upperContent.includes(completionMarker);

      // Semantic fallback check (case-insensitive)
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
    }

    return { data: { shouldEnd }, error: null };
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
  submissionId: string
): Promise<{ success: boolean; error: ApiError | null }> => {
  try {
    const { error } = await supabase
      .from('submissions')
      .update({
        status: SUBMISSION_STATUS.COMPLETED,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (error) {
      return { success: false, error: handleSupabaseError(error) };
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: handleSupabaseError(error) };
  }
};
