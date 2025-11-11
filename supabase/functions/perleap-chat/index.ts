import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import { getTeacherNameByAssignment, getOrCreateConversation, saveConversation } from '../shared/supabase.ts';
import type { Message } from '../shared/types.ts';
import { generateChatSystemPrompt } from '../_shared/prompts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, assignmentInstructions, submissionId, studentId, assignmentId, isInitialGreeting, language = 'en' } =
      await req.json();

    const teacherName = await getTeacherNameByAssignment(assignmentId);
    const conversation = await getOrCreateConversation(submissionId);
    const messages: Message[] = conversation.messages;

    if (!isInitialGreeting) {
      messages.push({ role: 'user', content: message });
    }

    const systemPrompt = await generateChatSystemPrompt(
      assignmentInstructions,
      teacherName,
      isInitialGreeting,
      language,
    );

    const openAIMessages: Message[] = isInitialGreeting
      ? [{ role: 'user', content: message }]
      : [...messages];

    const { content: aiMessage } = await createChatCompletion(
      systemPrompt,
      openAIMessages,
      0.7,
      300,
    );

    messages.push({ role: 'assistant', content: aiMessage });

    await saveConversation(
      conversation.id,
      submissionId,
      studentId,
      assignmentId,
      messages,
    );

    return new Response(JSON.stringify({ message: aiMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: handleOpenAIError(error) }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
