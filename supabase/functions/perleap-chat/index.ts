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
    const body = await req.json();
    const { 
      message, 
      assignmentInstructions, 
      submissionId, 
      studentId, 
      assignmentId, 
      isInitialGreeting, 
      language = 'en'
    } = body;

    // Check if streaming is requested (handle both boolean and string "true")
    const stream = body.stream === true || body.stream === 'true';

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
    let systemPrompt = await generateEnhancedChatSystemPrompt(
      assignmentInstructions,
      teacherName,
      teacherProfile,
      studentProfile,
      assignmentDetails,
      classroomResources,
      isInitialGreeting,
      language,
    );

    // Explicitly append completion rules to ensure the AI always uses the marker
    const completionRules = `
    
CRITICAL COMPLETION RULE (MANDATORY):
When you determine that the student has successfully completed ALL tasks mentioned in the assignment instructions (every single question or requirement), you MUST congratulate them briefly and IMMEDIATELY append the exact marker: [CONVERSATION_COMPLETE] at the very end of your message. 

DO NOT ask any more questions after identifying that the task is over.
DO NOT suggest more practice if all tasks are done.
YOUR FINAL MESSAGE MUST END WITH THE EXACT TEXT: [CONVERSATION_COMPLETE]

Example of a correct final response:
"Excellent work! You have finished all the math problems correctly. [CONVERSATION_COMPLETE]"

This is the ONLY way the system knows the activity is finished. If you do not include this exact string, the student will be stuck.`;

    systemPrompt += completionRules;

    const openAIMessages: Message[] = isInitialGreeting
      ? [{ role: 'user', content: message }]
      : [...messages];

    if (!stream) {
      const { content: aiMessage } = await createChatCompletion(
        systemPrompt,
        openAIMessages,
        0.7,
        1500,
        'smart'
      ) as { content: string };

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

      // Calculate turn count
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
    }

    // Streaming implementation
    const response = await createChatCompletion(
      systemPrompt,
      openAIMessages,
      0.7,
      1500,
      'smart',
      true
    ) as Response;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullContent = '';
    const completionMarker = '[CONVERSATION_COMPLETE]';
    let wasEndDetected = false;
    let streamBuffer = '';

    const readableStream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;

                try {
                  const data = JSON.parse(dataStr);
                  const content = data.choices[0]?.delta?.content || '';
                  if (content) {
                    fullContent += content;
                    streamBuffer += content;
                    
                    if (!wasEndDetected) {
                      const upperBuffer = streamBuffer.toUpperCase();
                      if (upperBuffer.includes(completionMarker)) {
                        wasEndDetected = true;
                        // Send everything in buffer up to the marker
                        const markerIndex = upperBuffer.indexOf(completionMarker);
                        const beforeMarker = streamBuffer.substring(0, markerIndex);
                        if (beforeMarker) {
                          controller.enqueue(encoder.encode(beforeMarker));
                        }
                        streamBuffer = ''; // Clear buffer
                      } else {
                        // If buffer is long enough that it can't be part of the marker, 
                        // send the beginning of it to keep stream smooth.
                        // We keep the last few characters in case the marker starts there.
                        const safetyMargin = completionMarker.length;
                        if (streamBuffer.length > safetyMargin * 2) {
                          const toSend = streamBuffer.substring(0, streamBuffer.length - safetyMargin);
                          controller.enqueue(encoder.encode(toSend));
                          streamBuffer = streamBuffer.substring(streamBuffer.length - safetyMargin);
                        }
                      }
                    }
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete JSON
                }
              }
            }
          }

          // Final flush of remaining buffer (if no marker was found)
          if (!wasEndDetected && streamBuffer) {
            controller.enqueue(encoder.encode(streamBuffer));
          }

          // Handle conversation end detection and cleanup
          let cleanedContent = fullContent;
          const markerIndex = fullContent.toUpperCase().indexOf(completionMarker);
          
          if (markerIndex !== -1) {
            cleanedContent = fullContent.substring(0, markerIndex) + 
                            fullContent.substring(markerIndex + completionMarker.length);
            cleanedContent = cleanedContent.trim();
            // Send a hidden signal to frontend
            controller.enqueue(encoder.encode('__CONVERSATION_END__'));
          }

          // Save the full conversation at the end
          messages.push({ role: 'assistant', content: cleanedContent });
          await saveConversation(
            conversation.id,
            submissionId,
            studentId,
            assignmentId,
            messages,
          );

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
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
