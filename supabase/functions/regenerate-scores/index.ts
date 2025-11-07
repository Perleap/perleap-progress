/**
 * Regenerate Scores - OpenAI Integration
 * 
 * Required Environment Variables:
 * - OPENAI_API_KEY: Your OpenAI API key
 * - OPENAI_MODEL (optional): Model to use (default: gpt-4-turbo-preview)
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 */

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

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
    console.log('Regenerate scores request:', { submissionId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get conversation context - get the most recent one if multiple exist
    const { data: conversations, error: convError } = await supabase
      .from('assignment_conversations')
      .select('*, submissions!inner(student_id)')
      .eq('submission_id', submissionId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (convError) {
      console.error('Error fetching conversation:', convError);
      throw convError;
    }

    if (!conversations || conversations.length === 0) {
      console.error('No conversation found for submission:', submissionId);
      throw new Error('No conversation found for this submission.');
    }

    const conversation = conversations[0];

    const conversationText = conversation.messages
      .map((msg: any) => `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`)
      .join('\n\n');

    const activityPrompt = `You are analyzing a student's learning conversation to assess their 5D development across five dimensions.

Analyze the conversation and rate them on a scale of 0-10 for each dimension:

**Cognitive (White):** Analytical thinking, problem-solving, understanding of concepts, critical reasoning
**Emotional (Red):** Self-awareness, emotional regulation, resilience, growth mindset
**Social (Blue):** Communication skills, collaboration, perspective-taking, empathy
**Creative (Yellow):** Innovation, original thinking, curiosity, exploration
**Behavioral (Green):** Task completion, persistence, self-direction, responsibility

Return ONLY a JSON object with scores (0-10):
{"cognitive": X, "emotional": X, "social": X, "creative": X, "behavioral": X}`;

    // Get OpenAI configuration
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Get model from environment or use default
    const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4-turbo-preview';

    // Call OpenAI for 5D scores analysis
    const scoresResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: activityPrompt },
          { role: 'user', content: conversationText }
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    let scores = { cognitive: 5, emotional: 5, social: 5, creative: 5, behavioral: 5 };
    if (scoresResponse.ok) {
      const scoresData = await scoresResponse.json();
      const scoresText = scoresData.choices[0].message.content;
      console.log('Raw AI scores response:', scoresText);
      
      // Log token usage for monitoring
      if (scoresData.usage) {
        console.log('OpenAI token usage (scores):', scoresData.usage);
      }
      
      try {
        const parsed = JSON.parse(scoresText.replace(/```json\n?|\n?```/g, '').trim());
        scores = parsed;
        console.log('Parsed scores:', scores);
      } catch (e) {
        console.error('Failed to parse scores:', e, 'Raw text:', scoresText);
      }
    } else {
      const errorText = await scoresResponse.text();
      console.error('OpenAI API error (scores):', scoresResponse.status, errorText);
    }

    // Save 5D snapshot
    const { error: snapshotError } = await supabase
      .from('five_d_snapshots')
      .insert({
        user_id: (conversation.submissions as any).student_id,
        scores,
        source: 'assignment'
      });

    if (snapshotError) {
      console.error('Error saving snapshot:', snapshotError);
      throw snapshotError;
    }

    return new Response(JSON.stringify({ scores }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in regenerate-scores:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
