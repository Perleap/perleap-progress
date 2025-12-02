/**
 * Regenerate Scores - OpenAI Integration
 * Refactored to use shared utilities and database prompts
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseClient } from '../shared/supabase.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import { generateScoresPrompt, generateScoreExplanationsPrompt } from '../_shared/prompts.ts';
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
    const { submissionId } = await req.json();
    logInfo('Regenerate scores request', { submissionId });

    const supabase = createSupabaseClient();

    // Get conversation context - get the most recent one if multiple exist
    const { data: conversations, error: convError } = await supabase
      .from('assignment_conversations')
      .select('*, submissions!inner(student_id)')
      .eq('submission_id', submissionId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (convError) {
      logError('Error fetching conversation', convError);
      throw convError;
    }

    if (!conversations || conversations.length === 0) {
      throw new Error('No conversation found for this submission.');
    }

    const conversation = conversations[0];
    const studentId = (conversation.submissions as any).student_id;

    // Get classroom_id from the submission
    const { data: submissionData } = await supabase
      .from('submissions')
      .select('assignment_id')
      .eq('id', submissionId)
      .single();

    const { data: assignmentData } = await supabase
      .from('assignments')
      .select('classroom_id')
      .eq('id', submissionData?.assignment_id)
      .single();

    const classroomId = assignmentData?.classroom_id;

    const conversationText = conversation.messages
      .map((msg: any) => `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`)
      .join('\n\n');

    // Detect language from conversation content (check for Hebrew characters)
    const hebrewPattern = /[\u0590-\u05FF]/;
    const detectedLanguage = hebrewPattern.test(conversationText) ? 'he' : 'en';
    logInfo('Detected language', { detectedLanguage });

    // Generate scores prompt from database
    const scoresPrompt = await generateScoresPrompt('the student', detectedLanguage);
    
    // Call OpenAI for 5D scores analysis
    const { content: scoresText } = await createChatCompletion(
      scoresPrompt,
      [{ role: 'user', content: conversationText }],
      0.5,
      500,
    );

    // Parse scores
    let scores = { vision: 5, values: 5, thinking: 5, connection: 5, action: 5 };
    try {
      scores = JSON.parse(scoresText.replace(/```json\n?|\n?```/g, '').trim());
    } catch (e) {
      logError('Failed to parse scores', e);
    }

    // Generate explanations for scores using shared prompt
    const scoresContext = `- Vision: ${scores.vision}/10
- Values: ${scores.values}/10  
- Thinking: ${scores.thinking}/10
- Connection: ${scores.connection}/10
- Action: ${scores.action}/10`;

    const explanationsPrompt = await generateScoreExplanationsPrompt(
      conversationText,
      scoresContext,
      detectedLanguage
    );

    const { content: explanationsText } = await createChatCompletion(
      explanationsPrompt,
      [],
      0.6,
      1500, // Increased token limit for Hebrew explanations which can be longer
    );

    let scoreExplanations = null;
    try {
      // Clean up the response: remove code blocks, normalize whitespace
      let cleanedText = explanationsText
        .replace(/```json\n?|\n?```/g, '')
        .trim();
      
      // Log the raw response for debugging
      logInfo('Raw explanations response length', { length: explanationsText.length });
      
      // Try to extract JSON object if there's extra text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      scoreExplanations = JSON.parse(cleanedText);
    } catch (e) {
      logError('Failed to parse score explanations', e);
      logError('Raw explanations text', { text: explanationsText.substring(0, 500) });
      // Create a fallback with empty explanations rather than failing
      scoreExplanations = {
        vision: '',
        values: '',
        thinking: '',
        connection: '',
        action: ''
      };
    }

    // Delete old snapshot for this submission if exists
    await supabase
      .from('five_d_snapshots')
      .delete()
      .eq('submission_id', submissionId);

    // Save 5D snapshot with explanations
    const { error: snapshotError } = await supabase
      .from('five_d_snapshots')
      .insert({
        user_id: studentId,
        scores,
        score_explanations: scoreExplanations,
        source: 'assignment',
        submission_id: submissionId,
        classroom_id: classroomId,
      });

    if (snapshotError) {
      logError('Error saving snapshot', snapshotError);
      throw snapshotError;
    }

    return new Response(JSON.stringify({ scores }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in regenerate-scores', error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
