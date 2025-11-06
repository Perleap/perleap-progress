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
    const { message, assignmentInstructions, submissionId, studentId, assignmentId } = await req.json();
    console.log('Perleap chat request:', { submissionId, studentId, assignmentId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get or create conversation
    let { data: conversation, error: convError } = await supabase
      .from('assignment_conversations')
      .select('*')
      .eq('submission_id', submissionId)
      .maybeSingle();

    if (convError && convError.code !== 'PGRST116') {
      console.error('Error fetching conversation:', convError);
      throw convError;
    }

    let messages = conversation?.messages || [];

    // Add user message to conversation
    messages.push({ role: 'user', content: message });

    // Prepare system prompt
    const systemPrompt = `You are a helpful and encouraging educational assistant helping a student work through their assignment. Your role is to:

- Guide the student through the assignment step-by-step
- Ask clarifying questions when needed
- Provide hints and encouragement without giving away answers
- Help them think through problems critically
- Celebrate their progress and insights
- Be warm, patient, and supportive throughout

**Assignment Instructions:**
${assignmentInstructions}

Work through this assignment collaboratively with the student. Help them understand concepts, encourage their thinking, and guide them to develop their own solutions.`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Call Lovable AI
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    // Add AI response to messages
    messages.push({ role: 'assistant', content: aiMessage });

    // Save conversation
    if (conversation) {
      await supabase
        .from('assignment_conversations')
        .update({ messages, updated_at: new Date().toISOString() })
        .eq('id', conversation.id);
    } else {
      await supabase
        .from('assignment_conversations')
        .insert({
          submission_id: submissionId,
          student_id: studentId,
          assignment_id: assignmentId,
          messages
        });
    }

    return new Response(JSON.stringify({ message: aiMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in perleap-chat:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});