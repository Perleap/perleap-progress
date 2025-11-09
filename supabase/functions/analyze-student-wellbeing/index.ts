/**
 * Analyze Student Wellbeing - OpenAI Integration
 * Detects concerning signs in student conversations
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../_shared/openai.ts';
import { logInfo, logError } from '../_shared/logger.ts';
import { generateWellbeingAnalysisPrompt } from './prompts.ts';
import type { WellbeingAnalysisResult, Message } from './types.ts';

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
    const { studentName, conversationMessages } = await req.json();

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
    const systemPrompt = generateWellbeingAnalysisPrompt(studentName);

    // Call OpenAI with temperature set for consistent, focused analysis
    const { content: responseText } = await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: conversationText }],
      0.3, // Low temperature for consistent, focused analysis
      800, // Sufficient tokens for detailed analysis
    );

    // Parse the response
    const analysis = parseWellbeingResponse(responseText);

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

