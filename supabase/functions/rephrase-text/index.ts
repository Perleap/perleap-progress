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
    const systemPrompt = `You are a professional educational content editor. 
Your task is to rephrase the provided text to make it clearer, more professional, 
and better structured while maintaining the original meaning and tone.

CRITICAL RULES:
- Output ONLY the rephrased text
- NO markdown formatting (no bold, italic, headers, etc.)
- NO bullet points or dashes at the start of lines
- NO emojis or special characters
- NO explanations, introductions, or meta-text
- NO numbered lists unless they were in the original
- Respond in the SAME language as the input (${language === 'he' ? 'Hebrew' : 'English'})
- Maintain the educational context and professionalism
- Keep the same general structure and length as the original
- If the text is already well-written, make minimal changes`;

    // Call OpenAI API
    const { content: rephrasedText } = await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: text }],
      0.7, // temperature for creativity while maintaining coherence
      1500 // max tokens
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
