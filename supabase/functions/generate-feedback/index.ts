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
import { generateFeedbackPrompt, generateScoresPrompt, generateScoreExplanationsPrompt } from '../_shared/prompts.ts';
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
    const { submissionId, studentId, assignmentId, language = 'en' } = await req.json();
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

    // Get assignment details early for parallel processing
    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('classroom_id, title, instructions, hard_skills, hard_skill_domain, classrooms(teacher_id)')
      .eq('id', assignmentId)
      .single();

    const classroomId = assignmentData?.classroom_id;

    // **OPTIMIZATION: Run all OpenAI calls in parallel**
    logInfo('Starting parallel OpenAI calls...');
    const startTime = Date.now();
    const [feedbackResult, scoresResult, hardSkillsResult] = await Promise.all([
      // 1. Generate feedback
      (async () => {
        const feedbackPrompt = await generateFeedbackPrompt(studentName, teacherName, language);
        const { content: feedbackText } = await createChatCompletion(
          feedbackPrompt,
          [{ role: 'user', content: conversationText }],
          0.4,
          1200,
        );
        return parseFeedback(feedbackText);
      })(),
      
      // 2. Generate 5D scores
      (async () => {
        const scoresPrompt = await generateScoresPrompt(studentName, language);
        const { content: scoresText } = await createChatCompletion(
          scoresPrompt,
          [{ role: 'user', content: conversationText }],
          0.5,
          500,
        );
        return parseScores(scoresText);
      })(),
      
      // 3. Generate hard skills assessment (if applicable)
      (async () => {
        if (!assignmentData?.hard_skills || !assignmentData?.hard_skill_domain) {
          return null;
        }

        try {
          let hardSkillsList: string[] = [];
          
          if (typeof assignmentData.hard_skills === 'string') {
            try {
              hardSkillsList = JSON.parse(assignmentData.hard_skills);
            } catch {
              hardSkillsList = assignmentData.hard_skills.split(',').map(s => s.trim()).filter(s => s);
            }
          } else if (Array.isArray(assignmentData.hard_skills)) {
            hardSkillsList = assignmentData.hard_skills;
          }

          if (hardSkillsList.length === 0) {
            return null;
          }

          logInfo('Generating hard skills assessment', { 
            domain: assignmentData.hard_skill_domain, 
            skillsCount: hardSkillsList.length 
          });

          const promptKey = language === 'he' ? 'hard_skill_assessment_he' : 'hard_skill_assessment_en';
          const { data: promptData, error: promptError } = await supabase
            .from('ai_prompts')
            .select('prompt_template')
            .eq('prompt_key', promptKey)
            .eq('is_active', true)
            .order('version', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (promptError || !promptData) {
            logError('Error fetching hard skill assessment prompt', promptError);
            return null;
          }

          let assessmentPrompt = promptData.prompt_template
            .replace(/\{\{domain\}\}/g, assignmentData.hard_skill_domain)
            .replace(/\{\{hard_skills\}\}/g, hardSkillsList.join(', '))
            .replace(/\{\{assignment_instructions\}\}/g, assignmentData.instructions || '');

          const { content: assessmentText } = await createChatCompletion(
            assessmentPrompt,
            [{ role: 'user', content: conversationText }],
            0.5,
            1000,
          );

          const cleaned = assessmentText.replace(/```json\n?|\n?```/g, '').trim();
          const assessments = JSON.parse(cleaned);
          
          if (!Array.isArray(assessments)) {
            throw new Error('Assessment response is not an array');
          }

          logInfo('Parsed hard skills assessments', { count: assessments.length });
          return { assessments, domain: assignmentData.hard_skill_domain };
        } catch (error) {
          logError('Hard skills assessment error', error);
          return null;
        }
      })(),
    ]);

    const parallelTime = Date.now() - startTime;
    logInfo(`Parallel OpenAI calls completed in ${parallelTime}ms`);

    // Parse feedback results
    let { studentFeedback, teacherFeedback } = feedbackResult;
    const scores = scoresResult;

    // Additional safety clean: Remove any framework terminology
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

    // Generate explanations for scores (this needs the scores, so can't be fully parallelized)
    logInfo('Generating score explanations...');
    const explanationsStartTime = Date.now();
    
    const scoresContext = `- Vision: ${scores.vision}/10
- Values: ${scores.values}/10  
- Thinking: ${scores.thinking}/10
- Connection: ${scores.connection}/10
- Action: ${scores.action}/10`;

    const explanationsPrompt = await generateScoreExplanationsPrompt(conversationText, scoresContext, language);

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

    const explanationsTime = Date.now() - explanationsStartTime;
    logInfo(`Score explanations generated in ${explanationsTime}ms`);

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

    // Save hard skills assessment if it was generated
    if (hardSkillsResult) {
      try {
        const assessmentRecords = hardSkillsResult.assessments.map(assessment => ({
          submission_id: submissionId,
          assignment_id: assignmentId,
          student_id: studentId,
          domain: hardSkillsResult.domain,
          skill_component: assessment.skill_component,
          current_level_percent: Math.min(100, Math.max(0, assessment.current_level_percent)),
          proficiency_description: assessment.proficiency_description,
          actionable_challenge: assessment.actionable_challenge,
        }));

        const { error: assessmentError } = await supabase
          .from('hard_skill_assessments')
          .insert(assessmentRecords);

        if (assessmentError) {
          logError('Error saving hard skill assessments', assessmentError);
        } else {
          logInfo('Successfully saved hard skill assessments', { count: assessmentRecords.length });
        }
      } catch (error) {
        logError('Error saving hard skills assessment', error);
      }
    }

    // **OPTIMIZATION: Run wellbeing analysis and notifications in parallel**
    logInfo('Starting wellbeing analysis and notifications in parallel...');
    const finalStartTime = Date.now();
    await Promise.all([
      // Wellbeing analysis
      (async () => {
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
            logInfo('Wellbeing analysis result:', { 
              alert_level: wellbeingAnalysis.alert_level, 
              alert_types: wellbeingAnalysis.alert_types 
            });

            if (wellbeingAnalysis.alert_level !== 'none' && wellbeingAnalysis.alert_types.length > 0) {
              logWarn('Wellbeing concerns detected', {
                level: wellbeingAnalysis.alert_level,
                types: wellbeingAnalysis.alert_types,
              });

              const alertInserts = wellbeingAnalysis.alert_types.map(alertType => ({
                submission_id: submissionId,
                student_id: studentId,
                assignment_id: assignmentId,
                alert_level: wellbeingAnalysis.alert_level,
                alert_type: alertType,
                triggered_messages: wellbeingAnalysis.triggered_messages,
                ai_analysis: wellbeingAnalysis.analysis,
              }));

              await supabase.from('student_alerts').insert(alertInserts);

              if (assignmentData) {
                const teacherId = assignmentData.classrooms?.teacher_id;
                const assignmentTitle = assignmentData.title;

                if (teacherId) {
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
          } else {
            logError('Wellbeing analysis request failed', {
              status: wellbeingResponse.status,
              statusText: wellbeingResponse.statusText
            });
          }
        } catch (wellbeingError) {
          logError('Wellbeing analysis error', wellbeingError);
        }
      })(),

      // Standard notifications
      (async () => {
        try {
          if (assignmentData) {
            const assignmentTitle = assignmentData.title;
            const teacherId = assignmentData.classrooms?.teacher_id;

            await Promise.all([
              // Student notification
              supabase.from('notifications').insert({
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
              }),

              // Teacher notification
              teacherId ? supabase.from('notifications').insert({
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
              }) : Promise.resolve(),
            ]);
          }
        } catch (notifError) {
          logError('Error creating feedback notifications', notifError);
        }
      })(),
    ]);

    const finalTime = Date.now() - finalStartTime;
    logInfo(`Wellbeing analysis and notifications completed in ${finalTime}ms`);
    
    const totalTime = Date.now() - startTime;
    logInfo(`Total feedback generation time: ${totalTime}ms`);

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
