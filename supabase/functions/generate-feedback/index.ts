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
import { logInfo, logError } from '../shared/logger.ts';

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
    const startTime = Date.now();

    // Fetch context data in parallel
    const [studentName, teacherName, assignmentResult] = await Promise.all([
      getStudentName(studentId),
      getTeacherNameByAssignment(assignmentId),
      supabase
        .from('assignments')
        .select('classroom_id, title, instructions, hard_skills, hard_skill_domain, classrooms(teacher_id)')
        .eq('id', assignmentId)
        .single()
    ]);

    const assignmentData = assignmentResult.data;
    const teacherId = (assignmentData?.classrooms as any)?.teacher_id;
    const classroomId = assignmentData?.classroom_id;

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

    // **OPTIMIZATION: Parallelize AI calls and background tasks**
    logInfo('Starting parallel AI calls...');
    const aiStartTime = Date.now();

    let hardSkillsList: string[] = [];
    try {
      if (assignmentData?.hard_skills) {
        hardSkillsList = typeof assignmentData.hard_skills === 'string' 
          ? JSON.parse(assignmentData.hard_skills) 
          : assignmentData.hard_skills;
      }
    } catch (e) {
      logError('Error parsing hard_skills, falling back to comma-separated parsing', e);
      if (typeof assignmentData?.hard_skills === 'string') {
        hardSkillsList = assignmentData.hard_skills.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    const feedbackPrompt = `You are an expert pedagogical AI assistant. Analyze the student's conversation and provide feedback and 5D scores.
    
    Student: ${studentName}
    Teacher: ${teacherName}
    Assignment: ${assignmentData?.title}
    Instructions: ${assignmentData?.instructions}
    
    Provide your response in the following JSON format:
    {
      "studentFeedback": "Supportive feedback directly to the student in ${language === 'he' ? 'Hebrew' : 'English'}.",
      "teacherFeedback": "Pedagogical insights for the teacher in ${language === 'he' ? 'Hebrew' : 'English'}.",
      "scores": {
        "vision": number (1-10),
        "values": number (1-10),
        "thinking": number (1-10),
        "connection": number (1-10),
        "action": number (1-10)
      },
      "scoreExplanations": {
        "vision": "Brief explanation",
        "values": "Brief explanation",
        "thinking": "Brief explanation",
        "connection": "Brief explanation",
        "action": "Brief explanation"
      }
    }

    Rules:
    - Respond in ${language === 'he' ? 'Hebrew' : 'English'}.
    - Be concise but insightful.
    - Focus on growth mindset.`;

    const hardSkillsPrompt = `Analyze the student's conversation and assess their performance on specific hard skills.
    
    Domain: ${assignmentData?.hard_skill_domain}
    Skills to assess: ${hardSkillsList.join(', ')}
    
    Provide your response in the following JSON format:
    {
      "hardSkillsAssessment": [
        {
          "skill_component": "Skill name",
          "current_level_percent": number (0-100),
          "proficiency_description": "Brief description of current proficiency in ${language === 'he' ? 'Hebrew' : 'English'}",
          "actionable_challenge": "One specific actionable challenge for growth in ${language === 'he' ? 'Hebrew' : 'English'}"
        }
      ]
    }

    Rules:
    - Respond in ${language === 'he' ? 'Hebrew' : 'English'}.
    - Only assess the requested skills.
    - Be objective and specific.`;

    const [feedbackResult, hardSkillsResult] = await Promise.all([
      // Call 1: Feedback and Scores (Smart/GPT-4o)
      createChatCompletion(
        feedbackPrompt,
        [{ role: 'user', content: `Analyze this conversation:\n\n${conversationText}` }],
        0.4,
        2000,
        'smart',
        false,
        'json_object'
      ),
      // Call 2: Hard Skills (Fast/GPT-4o-mini)
      hardSkillsList.length > 0 ? createChatCompletion(
        hardSkillsPrompt,
        [{ role: 'user', content: `Analyze this conversation for hard skills:\n\n${conversationText}` }],
        0.3,
        1500,
        'fast',
        false,
        'json_object'
      ) : Promise.resolve({ content: JSON.stringify({ hardSkillsAssessment: [] }) })
    ]);

    const feedbackData = JSON.parse((feedbackResult as { content: string }).content);
    const skillsData = JSON.parse((hardSkillsResult as { content: string }).content);
    
    logInfo(`AI calls completed in ${Date.now() - aiStartTime}ms`);

    let { studentFeedback, teacherFeedback, scores, scoreExplanations } = feedbackData;
    const { hardSkillsAssessment } = skillsData;

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
    teacherFeedback = removeFrameworkTerms(teacherFeedback);

    // **CRITICAL FIX: Background tasks should NOT block the response**
    // We only await the essential database saves
    logInfo('Saving essential data to database...');
    const dbStartTime = Date.now();

    const [snapshotResult, feedbackSaveResult] = await Promise.all([
      // 1. Save 5D snapshot
      supabase.from('five_d_snapshots').insert({
        user_id: studentId,
        scores,
        score_explanations: scoreExplanations,
        source: 'assignment',
        submission_id: submissionId,
        classroom_id: classroomId,
      }),

      // 2. Save feedback
      supabase.from('assignment_feedback').insert({
        submission_id: submissionId,
        student_id: studentId,
        assignment_id: assignmentId,
        student_feedback: studentFeedback,
        teacher_feedback: teacherFeedback,
        conversation_context: conversation.messages,
      }),

      // 3. Save hard skills assessment
      hardSkillsAssessment && hardSkillsAssessment.length > 0 ? (async () => {
        try {
          const assessmentRecords = hardSkillsAssessment.map((assessment: any) => ({
            submission_id: submissionId,
            assignment_id: assignmentId,
            student_id: studentId,
            domain: assignmentData?.hard_skill_domain,
            skill_component: assessment.skill_component,
            current_level_percent: Math.min(100, Math.max(0, assessment.current_level_percent)),
            proficiency_description: assessment.proficiency_description,
            actionable_challenge: assessment.actionable_challenge,
          }));
          const { error: err } = await supabase.from('hard_skill_assessments').insert(assessmentRecords);
          if (err) logError('Error saving hard skills', err);
        } catch (e) {
          logError('Error processing hard skills', e);
        }
      })() : Promise.resolve({ error: null }),
    ]);

    if (snapshotResult.error) {
      logError('Error saving 5D snapshot', snapshotResult.error);
      throw snapshotResult.error;
    }
    if (feedbackSaveResult.error) {
      logError('Error saving assignment feedback', feedbackSaveResult.error);
      throw feedbackSaveResult.error;
    }

    logInfo(`Essential database operations completed in ${Date.now() - dbStartTime}ms`);

    // 4. TRULY background tasks (don't await them)
    (async () => {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const wellbeingUrl = `${supabaseUrl}/functions/v1/analyze-student-wellbeing`;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        // Fire and forget calls
        fetch(wellbeingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            studentId,
            studentName,
            submissionId,
            assignmentId,
            teacherId,
            assignmentTitle: assignmentData?.title,
            conversationMessages: conversation.messages,
          }),
        }).catch(err => logError('Wellbeing call error', err));

        if (assignmentData) {
          const assignmentTitle = assignmentData.title;
          await Promise.all([
            supabase.from('notifications').insert({
              user_id: studentId,
              type: 'feedback_received',
              title: 'Feedback Received',
              message: `Your feedback for "${assignmentTitle}" is ready`,
              link: `/student/assignment/${assignmentId}`,
              actor_id: teacherId,
              metadata: { assignment_id: assignmentId, assignment_title: assignmentTitle, submission_id: submissionId },
              is_read: false,
            }),
            teacherId ? supabase.from('notifications').insert({
              user_id: teacherId,
              type: 'student_completed_activity',
              title: 'Activity Completed',
              message: `${studentName} completed "${assignmentTitle}"`,
              link: `/teacher/submission/${submissionId}`,
              actor_id: studentId,
              metadata: { assignment_id: assignmentId, assignment_title: assignmentTitle, student_id: studentId, student_name: studentName, submission_id: submissionId },
              is_read: false,
            }) : Promise.resolve(),
          ]).catch(err => logError('Notifications error', err));
        }
      } catch (err) {
        logError('Background tasks execution error', err);
      }
    })();

    logInfo(`Total feedback generation time (excluding background tasks): ${Date.now() - startTime}ms`);

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
