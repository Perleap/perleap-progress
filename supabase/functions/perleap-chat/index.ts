import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import { 
  getTeacherNameByAssignment, 
  getOrCreateConversation, 
  saveConversation,
  getTeacherProfile,
  getStudentProfile,
  getAssignmentDetails,
  getClassroomResources,
  getTeacherIdFromAssignment
} from '../shared/supabase.ts';
import type { Message } from '../shared/types.ts';
import { generateEnhancedChatSystemPrompt } from '../_shared/prompts.ts';

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

    // Fetch all context data in parallel for performance
    const [
      teacherName,
      conversation,
      teacherId,
      assignmentDetails,
    ] = await Promise.all([
      getTeacherNameByAssignment(assignmentId),
      getOrCreateConversation(submissionId),
      getTeacherIdFromAssignment(assignmentId),
      getAssignmentDetails(assignmentId),
    ]);

    // Fetch teacher profile, student profile, and classroom resources in parallel
    const [
      teacherProfile,
      studentProfile,
      classroomResources,
    ] = await Promise.all([
      teacherId ? getTeacherProfile(teacherId) : Promise.resolve(null),
      getStudentProfile(studentId),
      assignmentDetails?.classroom_id ? getClassroomResources(assignmentDetails.classroom_id) : Promise.resolve(null),
    ]);

    const messages: Message[] = conversation.messages;

    if (!isInitialGreeting) {
      messages.push({ role: 'user', content: message });
    }

    // Use enhanced system prompt with all context elements
    const systemPrompt = await generateEnhancedChatSystemPrompt(
      assignmentInstructions,
      teacherName,
      teacherProfile,
      studentProfile,
      assignmentDetails,
      classroomResources,
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

    // Check for conversation completion marker (case-insensitive and flexible)
    const completionMarker = '[CONVERSATION_COMPLETE]';
    let shouldEnd = false;
    let endReason = '';
    let cleanedMessage = aiMessage;

    // Check if marker exists anywhere in the message (more robust)
    const markerIndex = aiMessage.toUpperCase().indexOf(completionMarker);
    if (markerIndex !== -1) {
      shouldEnd = true;
      endReason = 'ai_detected';
      // Remove the marker and any surrounding whitespace
      cleanedMessage = aiMessage.substring(0, markerIndex) + 
                      aiMessage.substring(markerIndex + completionMarker.length);
      cleanedMessage = cleanedMessage.trim();
    }

    messages.push({ role: 'assistant', content: cleanedMessage });

    await saveConversation(
      conversation.id,
      submissionId,
      studentId,
      assignmentId,
      messages,
    );

    // Calculate turn count (exchanges = pairs of user + assistant messages)
    // Don't count the initial greeting
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const assistantMessageCount = messages.filter(m => m.role === 'assistant').length;
    const turnCount = Math.min(userMessageCount, assistantMessageCount);

    return new Response(JSON.stringify({ 
      message: cleanedMessage,
      turnCount,
      shouldEnd,
      endReason,
    }), {
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
