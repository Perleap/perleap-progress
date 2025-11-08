/**
 * Perleap Chat - OpenAI Integration
 * Refactored with shared utilities
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../_shared/openai.ts';
import {
  getTeacherNameByAssignment,
  getOrCreateConversation,
  saveConversation,
} from '../_shared/supabase.ts';
import { logInfo, logError } from '../_shared/logger.ts';
import type { Message } from '../_shared/types.ts';
import { generateChatSystemPrompt } from './prompts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, assignmentInstructions, submissionId, studentId, assignmentId, isInitialGreeting } =
      await req.json();

    logInfo('Perleap chat request', {
      submissionId,
      studentId,
      assignmentId,
      isInitialGreeting,
    });

    // Get teacher name
    const teacherName = await getTeacherNameByAssignment(assignmentId);
    logInfo(`Using teacher name: ${teacherName}`);

    // Get or create conversation
    const conversation = await getOrCreateConversation(submissionId);
    const messages: Message[] = conversation.messages;

    // For regular messages (not initial greeting), add user message to history
    if (!isInitialGreeting) {
      messages.push({ role: 'user', content: message });
    }

    // Generate system prompt
    const systemPrompt = generateChatSystemPrompt(
      assignmentInstructions,
      teacherName,
      isInitialGreeting,
    );

    // Prepare messages for OpenAI
    const openAIMessages: Message[] = isInitialGreeting
      ? [{ role: 'user', content: message }]
      : [...messages];

    // Call OpenAI
    const { content: aiMessage } = await createChatCompletion(
      systemPrompt,
      openAIMessages,
      0.7,
      2000,
    );

    // Add AI response to messages
    messages.push({ role: 'assistant', content: aiMessage });

    // Save conversation
    await saveConversation(
      conversation.id,
      submissionId,
      studentId,
      assignmentId,
      messages,
    );

    logInfo('Chat response generated successfully');

    return new Response(JSON.stringify({ message: aiMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in perleap-chat', error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
