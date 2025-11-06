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

    // Get conversation context
    const { data: conversation, error: convError } = await supabase
      .from('assignment_conversations')
      .select('*, submissions!inner(student_id)')
      .eq('submission_id', submissionId)
      .single();

    if (convError) {
      console.error('Error fetching conversation:', convError);
      throw convError;
    }

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const scoresResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: activityPrompt },
          { role: 'user', content: conversationText }
        ],
      }),
    });

    let scores = { cognitive: 5, emotional: 5, social: 5, creative: 5, behavioral: 5 };
    if (scoresResponse.ok) {
      const scoresData = await scoresResponse.json();
      const scoresText = scoresData.choices[0].message.content;
      console.log('Raw AI scores response:', scoresText);
      try {
        const parsed = JSON.parse(scoresText.replace(/```json\n?|\n?```/g, '').trim());
        scores = parsed;
        console.log('Parsed scores:', scores);
      } catch (e) {
        console.error('Failed to parse scores:', e, 'Raw text:', scoresText);
      }
    } else {
      console.error('Scores API call failed:', scoresResponse.status);
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
