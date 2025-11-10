/**
 * Generate Follow-up Assignment - OpenAI Integration
 * Creates personalized follow-up assignments based on student feedback
 */

import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import { logInfo, logError } from '../shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      teacherFeedback,
      studentFeedback,
      conversationContext,
      originalAssignmentTitle,
      studentName,
    } = await req.json();

    logInfo('Generating follow-up assignment', {
      studentName,
      originalAssignmentTitle,
    });

    // Prepare conversation text
    const conversationText = Array.isArray(conversationContext)
      ? conversationContext
          .map((msg: { role: string; content: string }) =>
            `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`
          )
          .join('\n\n')
      : '';

    // Create prompt for generating follow-up assignment
    const systemPrompt = `You are an expert educational designer specializing in personalized learning. Your task is to create a follow-up assignment for a student based on their recent work and the feedback they received.

The follow-up assignment should:
1. Address gaps or areas for growth identified in the feedback
2. Build on strengths demonstrated by the student
3. Be appropriately challenging but achievable
4. Focus on specific learning dimensions that need attention
5. Be engaging and relevant to the student's interests (if evident from their conversation)

Return your response as a valid JSON object with the following structure:
{
  "title": "Assignment title (concise and engaging)",
  "instructions": "Detailed assignment instructions (2-3 paragraphs explaining what the student should do)",
  "type": "text_essay",
  "target_dimensions": {
    "vision": boolean,
    "values": boolean,
    "thinking": boolean,
    "connection": boolean,
    "action": boolean
  },
  "reasoning": "Brief explanation of why this assignment was chosen (1-2 sentences)"
}

The type should be one of: "text_essay", "file_upload", "quiz", "project"
Target dimensions should be set to true for the 1-3 dimensions this assignment primarily focuses on.`;

    const userPrompt = `Original Assignment: ${originalAssignmentTitle}

Student Name: ${studentName}

Conversation Between Student and Learning Agent:
${conversationText}

Student Feedback (what the student saw):
${studentFeedback || 'No student feedback available'}

Teacher Insights (pedagogical analysis):
${teacherFeedback || 'No teacher feedback available'}

Based on this information, design a personalized follow-up assignment that will help ${studentName} grow in areas that need improvement while building on their strengths. The assignment should feel like a natural next step in their learning journey.`;

    const { content: assignmentText } = await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: userPrompt }],
      0.7,
      1500,
    );

    logInfo('Raw OpenAI response', { length: assignmentText.length });

    // Parse JSON response
    let assignmentData;
    try {
      // Remove markdown code blocks if present
      const cleaned = assignmentText
        .replace(/```json\n?|\n?```/g, '')
        .trim();
      assignmentData = JSON.parse(cleaned);
      logInfo('Successfully parsed assignment data');
    } catch (parseError) {
      logError('Failed to parse OpenAI response as JSON', parseError);
      throw new Error('Failed to generate valid assignment data. Please try again.');
    }

    // Validate required fields
    if (!assignmentData.title || !assignmentData.instructions) {
      throw new Error('Generated assignment is missing required fields');
    }

    // Ensure type is valid
    const validTypes = ['text_essay', 'file_upload', 'quiz', 'project'];
    if (!validTypes.includes(assignmentData.type)) {
      assignmentData.type = 'text_essay'; // Default fallback
    }

    // Ensure target_dimensions has proper structure
    if (!assignmentData.target_dimensions || typeof assignmentData.target_dimensions !== 'object') {
      assignmentData.target_dimensions = {
        vision: false,
        values: false,
        thinking: true,
        connection: false,
        action: false,
      };
    }

    logInfo('Follow-up assignment generated successfully', {
      title: assignmentData.title,
      type: assignmentData.type,
    });

    return new Response(
      JSON.stringify({
        title: assignmentData.title,
        instructions: assignmentData.instructions,
        type: assignmentData.type,
        target_dimensions: assignmentData.target_dimensions,
        reasoning: assignmentData.reasoning || '',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    const errorMessage = handleOpenAIError(error);
    logError('Error in generate-followup-assignment', error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

