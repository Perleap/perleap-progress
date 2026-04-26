/**
 * Generate Feedback - OpenAI Integration
 * Refactored with shared utilities and modules
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import {
  createSupabaseClient,
  getAssignmentModuleActivityContextText,
  getStudentName,
  getTeacherNameByAssignment,
} from '../shared/supabase.ts';
import { logInfo, logError } from '../shared/logger.ts';
import {
  domainForSkillComponent,
  formatHardSkillPairsForPrompt,
  parseHardSkillsFromDb,
} from '../_shared/hardSkillsFormat.ts';

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
        .select('classroom_id, title, instructions, hard_skills, hard_skill_domain, type, auto_publish_ai_feedback, classrooms(teacher_id)')
        .eq('id', assignmentId)
        .single()
    ]);

    const assignmentData = assignmentResult.data;
    const teacherId = (assignmentData?.classrooms as any)?.teacher_id;
    const classroomId = assignmentData?.classroom_id;
    const assignmentType = assignmentData?.type;
    const autoPublishAiFeedback = assignmentData?.auto_publish_ai_feedback !== false;

    let conversationText: string;
    let conversationMessages: any[] = [];
    let contextType: string;

    if (assignmentType === 'test') {
      // For test-type assignments, build context from test questions and responses
      const [questionsResult, responsesResult] = await Promise.all([
        supabase
          .from('test_questions')
          .select('*')
          .eq('assignment_id', assignmentId)
          .order('order_index', { ascending: true }),
        supabase
          .from('test_responses')
          .select('*')
          .eq('submission_id', submissionId),
      ]);

      const questions = questionsResult.data || [];
      const responses = responsesResult.data || [];

      if (questions.length === 0) {
        throw new Error('No test questions found for this assignment.');
      }

      const responseMap = new Map(responses.map((r: any) => [r.question_id, r]));

      conversationText = questions.map((q: any, i: number) => {
        const response = responseMap.get(q.id);
        const parts = [`Question ${i + 1} (${q.question_type}): ${q.question_text}`];

        if (q.question_type === 'multiple_choice' && q.options) {
          const options = q.options as { id: string; text: string }[];
          parts.push('Options: ' + options.map((o: any) => `${o.id}) ${o.text}`).join(', '));
          if (q.correct_option_id) {
            const correctOption = options.find((o: any) => o.id === q.correct_option_id);
            parts.push(`Correct Answer: ${correctOption?.text || q.correct_option_id}`);
          }
          const selectedOption = response?.selected_option_id
            ? options.find((o: any) => o.id === response.selected_option_id)
            : null;
          parts.push(`Student Answer: ${selectedOption?.text || response?.selected_option_id || 'No answer'}`);
        } else {
          parts.push(`Student Answer: ${response?.text_answer || 'No answer'}`);
        }

        return parts.join('\n');
      }).join('\n\n');

      conversationMessages = [{ role: 'user', content: `Test submission with ${questions.length} questions` }];
      contextType = 'test responses';
    } else if (assignmentType === 'text_essay') {
      const { data: subRow, error: subErr } = await supabase
        .from('submissions')
        .select('text_body')
        .eq('id', submissionId)
        .single();

      if (subErr || !subRow?.text_body?.trim()) {
        throw new Error(
          'No essay text found for this submission. Please write your essay before submitting.',
        );
      }

      const body = subRow.text_body.trim();
      conversationMessages = [{ role: 'user', content: body }];
      conversationText = `Essay submission:\n\n${body}`;
      contextType = 'essay';
    } else {
      // For conversation-based assignments, load chat messages
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

      conversationMessages = conversation.messages;
      conversationText = conversation.messages
        .map((msg: { role: string; content: string }) =>
          `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`
        )
        .join('\n\n');
      contextType = 'conversation';
    }

    // **OPTIMIZATION: Parallelize AI calls and background tasks**
    logInfo('Starting parallel AI calls...');
    const aiStartTime = Date.now();

    const moduleActivityContextText = await getAssignmentModuleActivityContextText(assignmentId);

    const skillPairs = parseHardSkillsFromDb(
      assignmentData?.hard_skills,
      assignmentData?.hard_skill_domain,
    );
    const skillsAssessText = formatHardSkillPairsForPrompt(
      skillPairs,
      assignmentData?.hard_skill_domain,
    );

    const feedbackPrompt = `You are an expert pedagogical AI assistant. Analyze the student's ${contextType === 'essay' ? 'written essay' : contextType} and provide feedback and 5D scores.
    
    Student: ${studentName}
    Teacher: ${teacherName}
    Assignment: ${assignmentData?.title}
    Assignment Type: ${assignmentType || 'questions'}
    Instructions: ${assignmentData?.instructions}
    ${moduleActivityContextText ? `\n\nModule learning context:\n${moduleActivityContextText}` : ''}
    
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

    const hardSkillsPrompt = `Analyze the student's ${contextType === 'essay' ? 'essay' : 'conversation'} and assess their performance on specific hard skills.

    Primary subject area (if single): ${assignmentData?.hard_skill_domain || 'N/A'}
    Skills to assess (with subject area when listed): ${skillsAssessText || '(none specified)'}
    
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
        [{ role: 'user', content: `Analyze this ${contextType}:\n\n${conversationText}` }],
        0.4,
        2000,
        'smart',
        false,
        'json_object'
      ),
      // Call 2: Hard Skills (Fast/GPT-4o-mini)
      skillPairs.length > 0 ? createChatCompletion(
        hardSkillsPrompt,
        [{ role: 'user', content: `Analyze this ${contextType} for hard skills:\n\n${conversationText}` }],
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

    const visibleToStudent = autoPublishAiFeedback;

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
        conversation_context: conversationMessages,
        visible_to_student: visibleToStudent,
      }),

      // 3. Save hard skills assessment
      hardSkillsAssessment && hardSkillsAssessment.length > 0 ? (async () => {
        try {
          const assessmentRecords = hardSkillsAssessment.map((assessment: any) => ({
            submission_id: submissionId,
            assignment_id: assignmentId,
            student_id: studentId,
            domain: domainForSkillComponent(
              skillPairs,
              assessment.skill_component,
              assignmentData?.hard_skill_domain,
            ),
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

    const { error: submissionFlagError } = await supabase
      .from('submissions')
      .update({ awaiting_teacher_feedback_release: !visibleToStudent })
      .eq('id', submissionId);

    if (submissionFlagError) {
      logError('Error updating submission release flags', submissionFlagError);
      throw submissionFlagError;
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
            conversationMessages,
          }),
        }).catch(err => logError('Wellbeing call error', err));

        if (assignmentData) {
          const assignmentTitle = assignmentData.title;
          const notifications: PromiseLike<unknown>[] = [];
          if (teacherId) {
            notifications.push(
              supabase.from('notifications').insert({
              user_id: teacherId,
              type: 'student_completed_activity',
              title: 'Activity Completed',
              message: `${studentName} completed "${assignmentTitle}"`,
              link: `/teacher/submission/${submissionId}`,
              actor_id: studentId,
              metadata: { assignment_id: assignmentId, assignment_title: assignmentTitle, student_id: studentId, student_name: studentName, submission_id: submissionId },
              is_read: false,
            }),
            );
          }
          await Promise.all(notifications).catch(err => logError('Notifications error', err));
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
