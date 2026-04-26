/**
 * Evaluate from Teacher Feedback
 * Takes teacher's written feedback and generates 5D scores + CRA via AI.
 * Used for assignment types where AI doesn't auto-evaluate (Project, Presentation, Langchain).
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import {
  createSupabaseClient,
  getStudentName,
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
    const {
      submissionId,
      studentId,
      assignmentId,
      teacherFeedback,
      language = 'en',
    } = await req.json();

    if (!submissionId || !studentId || !assignmentId || !teacherFeedback) {
      throw new Error('Missing required fields: submissionId, studentId, assignmentId, teacherFeedback');
    }

    const supabase = createSupabaseClient();
    const startTime = Date.now();

    const [studentName, assignmentResult] = await Promise.all([
      getStudentName(studentId),
      supabase
        .from('assignments')
        .select('classroom_id, title, instructions, hard_skills, hard_skill_domain, type, classrooms(teacher_id)')
        .eq('id', assignmentId)
        .single(),
    ]);

    const assignmentData = assignmentResult.data;
    const classroomId = assignmentData?.classroom_id;
    const teacherId = (assignmentData as any)?.classrooms?.teacher_id;

    const skillPairs = parseHardSkillsFromDb(
      assignmentData?.hard_skills,
      assignmentData?.hard_skill_domain,
    );
    const skillsAssessText = formatHardSkillPairsForPrompt(
      skillPairs,
      assignmentData?.hard_skill_domain,
    );

    const langLabel = language === 'he' ? 'Hebrew' : 'English';

    const feedbackPrompt = `You are an expert pedagogical AI assistant. A teacher has manually reviewed a student's work and provided written feedback. Based on the teacher's assessment, generate 5D scores and structured feedback.

Student: ${studentName}
Assignment: ${assignmentData?.title}
Assignment Type: ${assignmentData?.type}
Instructions: ${assignmentData?.instructions}

Generate your response in the following JSON format:
{
  "studentFeedback": "Supportive feedback to the student based on the teacher's assessment, in ${langLabel}.",
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
- Respond in ${langLabel}.
- Base scores on the teacher's feedback, not your own assessment.
- Be concise but insightful.`;

    const hardSkillsPrompt = `Based on a teacher's review of a student's work, assess specific hard skills.

Primary subject area (if single): ${assignmentData?.hard_skill_domain || 'N/A'}
Skills to assess (with subject area when listed): ${skillsAssessText || '(none specified)'}

Provide your response in the following JSON format:
{
  "hardSkillsAssessment": [
    {
      "skill_component": "Skill name",
      "current_level_percent": number (0-100),
      "proficiency_description": "Brief description in ${langLabel}",
      "actionable_challenge": "One specific challenge for growth in ${langLabel}"
    }
  ]
}

Rules:
- Respond in ${langLabel}.
- Only assess the requested skills.
- Base assessment on the teacher's feedback.`;

    logInfo('Starting AI evaluation from teacher feedback...');

    const [feedbackResult, hardSkillsResult] = await Promise.all([
      createChatCompletion(
        feedbackPrompt,
        [{ role: 'user', content: `Teacher's feedback:\n\n${teacherFeedback}` }],
        0.4,
        2000,
        'smart',
        false,
        'json_object',
      ),
      skillPairs.length > 0
        ? createChatCompletion(
            hardSkillsPrompt,
            [{ role: 'user', content: `Teacher's feedback:\n\n${teacherFeedback}` }],
            0.3,
            1500,
            'fast',
            false,
            'json_object',
          )
        : Promise.resolve({ content: JSON.stringify({ hardSkillsAssessment: [] }) }),
    ]);

    const feedbackData = JSON.parse((feedbackResult as { content: string }).content);
    const skillsData = JSON.parse((hardSkillsResult as { content: string }).content);

    const { studentFeedback, scores, scoreExplanations } = feedbackData;
    const { hardSkillsAssessment } = skillsData;

    const [snapshotResult, feedbackSaveResult] = await Promise.all([
      supabase.from('five_d_snapshots').insert({
        user_id: studentId,
        scores,
        score_explanations: scoreExplanations,
        source: 'assignment',
        submission_id: submissionId,
        classroom_id: classroomId,
      }),

      supabase.from('assignment_feedback').insert({
        submission_id: submissionId,
        student_id: studentId,
        assignment_id: assignmentId,
        student_feedback: studentFeedback,
        teacher_feedback: teacherFeedback,
        conversation_context: [],
      }),

      hardSkillsAssessment && hardSkillsAssessment.length > 0
        ? (async () => {
            try {
              const records = hardSkillsAssessment.map((a: any) => ({
                submission_id: submissionId,
                assignment_id: assignmentId,
                student_id: studentId,
                domain: domainForSkillComponent(
                  skillPairs,
                  a.skill_component,
                  assignmentData?.hard_skill_domain,
                ),
                skill_component: a.skill_component,
                current_level_percent: Math.min(100, Math.max(0, a.current_level_percent)),
                proficiency_description: a.proficiency_description,
                actionable_challenge: a.actionable_challenge,
              }));
              const { error: err } = await supabase.from('hard_skill_assessments').insert(records);
              if (err) logError('Error saving hard skills', err);
            } catch (e) {
              logError('Error processing hard skills', e);
            }
          })()
        : Promise.resolve({ error: null }),
    ]);

    if (snapshotResult.error) {
      logError('Error saving 5D snapshot', snapshotResult.error);
      throw snapshotResult.error;
    }
    if (feedbackSaveResult.error) {
      logError('Error saving feedback', feedbackSaveResult.error);
      throw feedbackSaveResult.error;
    }

    logInfo(`Evaluate-from-feedback completed in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({ studentFeedback, scores }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in evaluate-from-feedback', error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
