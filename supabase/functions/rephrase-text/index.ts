/**
 * Rephrase Text - OpenAI Integration
 * Edge function to rephrase educational content using AI
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, language = 'en' } = await req.json();

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required and must be a non-empty string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create system prompt with strict rules for clean output
    const systemPrompt = `You are an expert educational content editor. 
Your task is to rephrase the provided text to be significantly more concise, professional, and direct. 

CRITICAL RULES:
- BE CONCISE: Use the minimum number of words necessary to convey the full meaning.
- TO THE POINT: Get straight to the core message. Eliminate wordy explanations, fluff, and unnecessary introductions.
- ACCURATE: Maintain all factual information and educational context.
- NO meta-text: Do NOT include phrases like "Here is a rephrased version".
- NO markdown: Output ONLY the plain text.
- Respond in the SAME language as the input (${language === 'he' ? 'Hebrew' : 'English'}).
- Maintain the original meaning but optimize for brevity.`;

    // Call OpenAI API
    const { content: rephrasedText } = await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: text }],
      0.3, // Lower temperature for more concise, focused output
      1500, // max tokens
      'fast' // Use gpt-4o-mini for speed
    );

    // Clean up the response to ensure no formatting slipped through
    let cleanedText = rephrasedText.trim();
    
    // Remove any markdown bold/italic
    cleanedText = cleanedText.replace(/\*\*(.+?)\*\*/g, '$1');
    cleanedText = cleanedText.replace(/\*(.+?)\*/g, '$1');
    cleanedText = cleanedText.replace(/_(.+?)_/g, '$1');
    
    // Remove leading dashes or bullets from lines
    cleanedText = cleanedText.split('\n').map(line => {
      return line.replace(/^[\s-•\*]+/, '').trim();
    }).filter(line => line.length > 0).join('\n');

    return new Response(
      JSON.stringify({ 
        rephrasedText: cleanedText,
        originalLength: text.length,
        rephrasedLength: cleanedText.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in rephrase-text function:', error);
    
    const errorMessage = handleOpenAIError(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
