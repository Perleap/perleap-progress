/**
 * Generate Feedback - OpenAI Integration
 * Refactored with shared utilities and modules
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import {
  createSupabaseClient,
  getStudentName,
  getTeacherNameByAssignment,
} from '../shared/supabase.ts';
import { logInfo, logError, logWarn } from '../shared/logger.ts';
import { generateFeedbackPrompt, generateScoresPrompt } from '../_shared/prompts.ts';
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
    const supabase = createSupabaseClient();

    // Fetch student and teacher names
    const studentName = await getStudentName(studentId);
    const teacherName = await getTeacherNameByAssignment(assignmentId);

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

    if (!conversation.messages || conversation.messages.length === 0) {
      throw new Error('No conversation messages found. Please chat with Perleap first.');
    }

    // Prepare conversation text
    const conversationText = conversation.messages
      .map((msg: { role: string; content: string }) =>
        `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`
      )
      .join('\n\n');

    // Generate feedback
    const feedbackPrompt = await generateFeedbackPrompt(studentName, teacherName);
    const { content: feedbackText } = await createChatCompletion(
      feedbackPrompt,
      [{ role: 'user', content: conversationText }],
      0.4,
      1200,
    );

    // Parse feedback
    let { studentFeedback, teacherFeedback } = parseFeedback(feedbackText);

    // Additional safety clean: Remove any framework terminology that might have slipped through
    const removeFrameworkTerms = (text: string): string => {
      if (!text) return text;
      let cleaned = text;
      cleaned = cleaned.replace(/Quantum Education Doctrine/gi, '');
      cleaned = cleaned.replace(/Student Wave Function/gi, '');
      cleaned = cleaned.replace(/\bSWF\b/g, '');
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      return cleaned;
    };

    studentFeedback = removeFrameworkTerms(studentFeedback);
    teacherFeedback = teacherFeedback ? removeFrameworkTerms(teacherFeedback) : null;

    if (!teacherFeedback) {
      logWarn('Teacher feedback not found in response');
    }

    // Generate 5D scores
    const scoresPrompt = await generateScoresPrompt(studentName);
    const { content: scoresText } = await createChatCompletion(
      scoresPrompt,
      [{ role: 'user', content: conversationText }],
      0.5,
      500,
    );

    const scores = parseScores(scoresText);

    // Generate explanations for scores
    const explanationsPrompt = `You are an expert educator analyzing a student's learning conversation to provide actionable insights for their teacher.

STUDENT CONVERSATION:
${conversationText}

SCORES ASSIGNED:
- Vision: ${scores.vision}/10
- Values: ${scores.values}/10  
- Thinking: ${scores.thinking}/10
- Connection: ${scores.connection}/10
- Action: ${scores.action}/10

For each dimension, write a specific explanation that:
1. References concrete examples from the student's actual responses
2. Explains what they did well or what they struggled with
3. Provides actionable insight for the teacher

Be specific - quote or paraphrase what the student said. Avoid generic statements.

Return ONLY a JSON object with concise explanations (1-2 sentences each):
{"vision": "...", "values": "...", "thinking": "...", "connection": "...", "action": "..."}`;

    const { content: explanationsText } = await createChatCompletion(
      explanationsPrompt,
      [],
      0.6,
      500,
    );

    let scoreExplanations = null;
    try {
      const cleaned = explanationsText.replace(/```json\n?|\n?```/g, '').trim();
      scoreExplanations = JSON.parse(cleaned);
    } catch (e) {
      logWarn('Failed to parse score explanations', e);
    }

    // Get classroom_id and assignment details in one query
    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('classroom_id, title, classrooms(teacher_id)')
      .eq('id', assignmentId)
      .single();

    const classroomId = assignmentData?.classroom_id;

    // Save 5D snapshot with explanations
    const { error: snapshotError } = await supabase.from('five_d_snapshots').insert({
      user_id: studentId,
      scores,
      score_explanations: scoreExplanations,
      source: 'assignment',
      submission_id: submissionId,
      classroom_id: classroomId,
    });

    if (snapshotError) {
      logError('Error saving snapshot', snapshotError);
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

    // Analyze student wellbeing for concerning signs
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const wellbeingUrl = `${supabaseUrl}/functions/v1/analyze-student-wellbeing`;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const wellbeingResponse = await fetch(wellbeingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          studentName,
          conversationMessages: conversation.messages,
        }),
      });

      if (wellbeingResponse.ok) {
        const wellbeingAnalysis = await wellbeingResponse.json();

        // If concerns detected, save alerts and notify teacher
        if (wellbeingAnalysis.alert_level !== 'none' && wellbeingAnalysis.alert_types.length > 0) {
          logWarn('Wellbeing concerns detected', {
            level: wellbeingAnalysis.alert_level,
            types: wellbeingAnalysis.alert_types,
          });

          // Save alerts (one per alert type)
          const alertInserts = wellbeingAnalysis.alert_types.map(alertType => ({
            submission_id: submissionId,
            student_id: studentId,
            assignment_id: assignmentId,
            alert_level: wellbeingAnalysis.alert_level,
            alert_type: alertType,
            triggered_messages: wellbeingAnalysis.triggered_messages,
            ai_analysis: wellbeingAnalysis.analysis,
          }));

          const { error: alertError } = await supabase.from('student_alerts').insert(alertInserts);

          if (alertError) {
            logError('Error saving wellbeing alerts', alertError);
          }

          // Use already fetched assignment data
          if (assignmentData) {
            const teacherId = assignmentData.classrooms?.teacher_id;
            const assignmentTitle = assignmentData.title;

            if (teacherId) {
              // Create urgent notification for teacher
              const notifTitle = wellbeingAnalysis.alert_level === 'critical'
                ? '🚨 CRITICAL Student Wellbeing Alert'
                : '⚠️ Student Wellbeing Alert';
              
              await supabase.from('notifications').insert({
                user_id: teacherId,
                type: `student_alert_${wellbeingAnalysis.alert_level}`,
                title: notifTitle,
                message: `${studentName} showed concerning signs in "${assignmentTitle}". Please review immediately.`,
                link: `/teacher/submission/${submissionId}`,
                metadata: {
                  assignment_id: assignmentId,
                  assignment_title: assignmentTitle,
                  student_id: studentId,
                  student_name: studentName,
                  submission_id: submissionId,
                  alert_level: wellbeingAnalysis.alert_level,
                  alert_types: wellbeingAnalysis.alert_types,
                },
                is_read: false,
              });

              // Send email notification
              try {
                const { sendAlertEmail } = await import('../analyze-student-wellbeing/email.ts');
                await sendAlertEmail(
                  teacherId,
                  studentName,
                  assignmentTitle,
                  wellbeingAnalysis.alert_level,
                  wellbeingAnalysis.analysis,
                  submissionId,
                );
              } catch (emailError) {
                logError('Error sending alert email', emailError);
              }
            }
          }
        }
      }
    } catch (wellbeingError) {
      // Don't fail feedback generation if wellbeing analysis fails
      logError('Wellbeing analysis error', wellbeingError);
    }

    // Create notifications for both student and teacher
    try {
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
