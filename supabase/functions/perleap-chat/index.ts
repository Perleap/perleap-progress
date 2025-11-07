/**
 * Perleap Chat - OpenAI Integration
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
    const { message, assignmentInstructions, submissionId, studentId, assignmentId, isInitialGreeting } = await req.json();
    console.log('Perleap chat request:', { submissionId, studentId, assignmentId, isInitialGreeting });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch teacher name from database
    console.log('Fetching teacher name for assignment:', assignmentId);
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('assignments')
      .select('classroom_id, classrooms(teacher_id)')
      .eq('id', assignmentId)
      .single();

    if (assignmentError) {
      console.error('Error fetching assignment:', assignmentError);
      throw assignmentError;
    }

    let teacherName = 'your teacher';
    if (assignmentData?.classrooms?.teacher_id) {
      const { data: teacherProfile, error: teacherError } = await supabase
        .from('teacher_profiles')
        .select('full_name')
        .eq('user_id', assignmentData.classrooms.teacher_id)
        .maybeSingle();

      if (teacherError) {
        console.error('Error fetching teacher profile:', teacherError);
      }

      if (teacherProfile?.full_name) {
        teacherName = teacherProfile.full_name;
        console.log('Found teacher name:', teacherName);
      } else {
        console.log('No teacher profile found, using default');
      }
    }
    console.log('Using teacher name:', teacherName);

    // Get or create conversation - handle multiple conversations by getting the most recent
    let { data: conversations, error: convError } = await supabase
      .from('assignment_conversations')
      .select('*')
      .eq('submission_id', submissionId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (convError) {
      console.error('Error fetching conversation:', convError);
      throw convError;
    }

    let conversation = conversations && conversations.length > 0 ? conversations[0] : null;
    let messages = conversation?.messages || [];

    // For initial greeting, don't add the system message to history
    // For regular messages, add user message to conversation
    if (!isInitialGreeting) {
      messages.push({ role: 'user', content: message });
    }

    // Prepare system prompt
    const teacherNameText = teacherName ? teacherName : 'your teacher';
    const greetingInstruction = isInitialGreeting 
      ? `You must start your response with: "Hello I'm ${teacherNameText}'s perleap" and then continue with your warm greeting. DO NOT use emojis.`
      : '';
    
    const systemPrompt = `You are a warm, encouraging educational assistant helping a student complete their assignment.

Your approach:
- Guide them through the assignment step-by-step in a conversational way
- Ask thoughtful questions that help them think deeper
- Provide hints and scaffolding, but never give direct answers
- Celebrate insights and progress
- Be patient, supportive, and adaptive to their pace
- Help them build confidence in their own thinking
- DO NOT use emojis or special characters in your responses

Keep the pedagogical framework in mind but don't make it explicit. Focus on the learning journey, not assessment.

**Assignment Instructions:**
${assignmentInstructions}

${greetingInstruction}

${isInitialGreeting ? 'After introducing yourself, warmly acknowledge the assignment topic and ask the student how they would like to begin or what their initial thoughts are. Remember: NO emojis.' : ''}`;

    // Get OpenAI configuration
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Get model from environment or use default
    const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4-turbo-preview';

    // Prepare messages for OpenAI
    // For initial greeting, include the trigger message for OpenAI but it's not in history
    const openAIMessages = isInitialGreeting 
      ? [{ role: 'user', content: message }]
      : [...messages];

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...openAIMessages
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      // Parse OpenAI error for better error messages
      try {
        const errorData = JSON.parse(errorText);
        const errorMessage = errorData.error?.message || errorText;
        throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`);
      } catch {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message.content;

    // Log token usage for monitoring
    if (data.usage) {
      console.log('OpenAI token usage:', data.usage);
    }

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