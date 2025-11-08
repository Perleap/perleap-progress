/**
 * Generate Feedback - OpenAI Integration
 * Refactored with shared utilities and modules
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../_shared/openai.ts';
import {
  createSupabaseClient,
  getStudentName,
  getTeacherNameByAssignment,
} from '../_shared/supabase.ts';
import { logInfo, logError, logWarn } from '../_shared/logger.ts';
import { generateFeedbackPrompt, generateScoresPrompt } from './prompts.ts';
import { parseFeedback, parseScores } from './parser.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { submissionId, studentId, assignmentId } = await req.json();
    logInfo('Generate feedback request', { submissionId, studentId, assignmentId });

    const supabase = createSupabaseClient();

    // Fetch student and teacher names
    const studentName = await getStudentName(studentId);
    const teacherName = await getTeacherNameByAssignment(assignmentId);

    logInfo(`Using names: student=${studentName}, teacher=${teacherName}`);

    // Get conversation context
    const { data: conversations, error: convError } = await supabase
      .from('assignment_conversations')
      .select('*')
      .eq('submission_id', submissionId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (convError || !conversations || conversations.length === 0) {
      throw new Error(
        'No conversation found for this submission. Please chat with Perleap before completing.',
      );
    }

    const conversation = conversations[0];
    logInfo(`Found conversation with ${conversation.messages?.length || 0} messages`);

    if (!conversation.messages || conversation.messages.length === 0) {
      throw new Error('No conversation messages found. Please chat with Perleap first.');
    }

    // Prepare conversation text
    const conversationText = conversation.messages
      .map((msg: { role: string; content: string }) =>
        `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`
      )
      .join('\n\n');

    logInfo(`Conversation text length: ${conversationText.length} characters`);

    // Generate feedback
    const feedbackPrompt = generateFeedbackPrompt(studentName, teacherName);
    const { content: feedbackText } = await createChatCompletion(
      feedbackPrompt,
      [{ role: 'user', content: conversationText }],
      0.4,
      3000,
    );

    logInfo('Feedback generated, parsing...');

    // Parse feedback
    const { studentFeedback, teacherFeedback } = parseFeedback(feedbackText);

    logInfo(
      `Parsed feedback: student=${studentFeedback.length} chars, teacher=${teacherFeedback ? teacherFeedback.length : 0} chars`,
    );

    if (!teacherFeedback) {
      logWarn('Teacher feedback not found in response');
    }

    // Generate 5D scores
    const scoresPrompt = generateScoresPrompt(studentName);
    const { content: scoresText } = await createChatCompletion(
      scoresPrompt,
      [{ role: 'user', content: conversationText }],
      0.5,
      500,
    );

    const scores = parseScores(scoresText);
    logInfo('5D scores generated', scores);

    // Get classroom_id from the assignment
    const { data: assignmentInfo } = await supabase
      .from('assignments')
      .select('classroom_id')
      .eq('id', assignmentId)
      .single();

    const classroomId = assignmentInfo?.classroom_id;

    // Save 5D snapshot
    const { error: snapshotError } = await supabase.from('five_d_snapshots').insert({
      user_id: studentId,
      scores,
      source: 'assignment',
      submission_id: submissionId,
      classroom_id: classroomId,
    });

    if (snapshotError) {
      logError('Error saving snapshot', snapshotError);
    } else {
      logInfo('5D snapshot saved successfully');
    }

    // Save feedback
    const { error: feedbackError } = await supabase.from('assignment_feedback').insert({
      submission_id: submissionId,
      student_id: studentId,
      assignment_id: assignmentId,
      student_feedback: studentFeedback,
      teacher_feedback: teacherFeedback,
      conversation_context: conversation.messages,
    });

    if (feedbackError) {
      logError('Error saving feedback', feedbackError);
      throw feedbackError;
    }

    logInfo('Feedback saved successfully');

    // Create notifications for both student and teacher
    try {
      // Get assignment details
      const { data: assignmentData } = await supabase
        .from('assignments')
        .select('title, classroom_id, classrooms(teacher_id)')
        .eq('id', assignmentId)
        .single();

      if (assignmentData) {
        const assignmentTitle = assignmentData.title;
        const teacherId = assignmentData.classrooms?.teacher_id;

        // Notify student about feedback received
        await supabase.from('notifications').insert({
          user_id: studentId,
          type: 'feedback_received',
          title: 'Feedback Received',
          message: `Your feedback for "${assignmentTitle}" is ready`,
          link: `/student/assignment/${assignmentId}`,
          metadata: {
            assignment_id: assignmentId,
            assignment_title: assignmentTitle,
            submission_id: submissionId,
          },
          is_read: false,
        });

        // Notify teacher about student completing activity
        if (teacherId) {
          await supabase.from('notifications').insert({
            user_id: teacherId,
            type: 'student_completed_activity',
            title: 'Activity Completed',
            message: `${studentName} completed "${assignmentTitle}"`,
            link: `/teacher/submission/${submissionId}`,
            metadata: {
              assignment_id: assignmentId,
              assignment_title: assignmentTitle,
              student_id: studentId,
              student_name: studentName,
              submission_id: submissionId,
            },
            is_read: false,
          });
        }

        logInfo('Notifications created for feedback');
      }
    } catch (notifError) {
      // Don't fail the feedback generation if notifications fail
      logError('Error creating feedback notifications', notifError);
    }

    return new Response(
      JSON.stringify({
        studentFeedback,
        teacherFeedback,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in generate-feedback', error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
