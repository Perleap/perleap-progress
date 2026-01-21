/**
 * Analyze Student Wellbeing - OpenAI Integration
 * Detects concerning signs in student conversations
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import { createSupabaseClient } from '../shared/supabase.ts';
import { logInfo, logError } from '../shared/logger.ts';
import { generateWellbeingAnalysisPrompt } from '../_shared/prompts.ts';
import type { WellbeingAnalysisResult, Message } from './types.ts';
import { sendAlertEmail } from './email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Parse AI response into structured wellbeing analysis
 */
const parseWellbeingResponse = (responseText: string): WellbeingAnalysisResult => {
  try {
    // Remove markdown code blocks if present
    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.alert_level || !Array.isArray(parsed.alert_types) || !Array.isArray(parsed.triggered_messages)) {
      throw new Error('Invalid response structure');
    }

    return parsed as WellbeingAnalysisResult;
  } catch (error) {
    logError('Failed to parse wellbeing response', { responseText, error });
    // Return safe fallback
    return {
      alert_level: 'none',
      alert_types: [],
      triggered_messages: [],
      analysis: 'Analysis parsing failed. Manual review recommended.',
    };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      studentId, 
      studentName, 
      submissionId, 
      assignmentId, 
      teacherId, 
      assignmentTitle, 
      conversationMessages 
    } = await req.json();

    if (!studentName || !conversationMessages || !Array.isArray(conversationMessages)) {
      throw new Error('Invalid request: studentName and conversationMessages required');
    }

    // Prepare conversation text with message indices for tracking
    const conversationText = conversationMessages
      .map((msg: Message, index: number) => {
        const role = msg.role === 'user' ? 'Student' : 'Agent';
        return `[Message ${index}] ${role}: ${msg.content}`;
      })
      .join('\n\n');

    // Generate analysis prompt
    const systemPrompt = await generateWellbeingAnalysisPrompt(studentName);

    // Call OpenAI with temperature set for consistent, focused analysis
    const { content: responseText } = await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: conversationText }],
      0.3, // Low temperature for consistent, focused analysis
      800, // Sufficient tokens for detailed analysis
    );

    // Parse the response
    const analysis = parseWellbeingResponse(responseText);

    // If alert is detected, save to database and notify teacher
    if (analysis.alert_level !== 'none' && studentId && submissionId) {
      logInfo(`Wellbeing alert detected: ${analysis.alert_level}`, { studentId, alertTypes: analysis.alert_types });
      
      const supabase = createSupabaseClient();

      // 1. Save alert to student_alerts table
      const { data: alertData, error: alertError } = await supabase
        .from('student_alerts')
        .insert({
          student_id: studentId,
          submission_id: submissionId,
          assignment_id: assignmentId,
          alert_level: analysis.alert_level,
          alert_type: analysis.alert_types,
          analysis: analysis.analysis,
          triggered_messages: analysis.triggered_messages,
        })
        .select()
        .single();

      if (alertError) {
        logError('Failed to save student alert', alertError);
      } else if (teacherId) {
        // 2. Create in-app notification for teacher
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: teacherId,
          type: 'wellbeing_alert',
          title: analysis.alert_level === 'critical' ? 'CRITICAL Wellbeing Alert' : 'Wellbeing Concern Detected',
          message: `${studentName} showed signs of ${analysis.alert_types.join(', ')} during "${assignmentTitle || 'an assignment'}"`,
          link: `/teacher/submission/${submissionId}?alert=${alertData.id}`,
          metadata: { 
            alert_id: alertData.id, 
            student_id: studentId, 
            student_name: studentName,
            alert_level: analysis.alert_level,
            alert_types: analysis.alert_types
          },
          is_read: false,
        });

        if (notifError) logError('Failed to create wellbeing notification', notifError);

        // 3. Send email to teacher
        await sendAlertEmail(
          teacherId,
          studentName,
          assignmentTitle || 'Assignment',
          analysis.alert_level,
          analysis.analysis,
          submissionId
        );
      }
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in analyze-student-wellbeing', error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

