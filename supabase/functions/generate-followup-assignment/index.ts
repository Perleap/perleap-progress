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
      originalAssignmentInstructions,
      studentName,
    } = await req.json();

    logInfo('Generating follow-up assignment', {
      studentName,
      originalAssignmentTitle,
    });

    // Detect language from original assignment instructions
    const containsHebrew = (text: string): boolean => {
      const hebrewRegex = /[\u0590-\u05FF]/;
      return hebrewRegex.test(text || '');
    };

    const detectedLanguage = containsHebrew(originalAssignmentInstructions || '') ? 'he' : 'en';
    const languageInstruction = detectedLanguage === 'he' 
      ? 'CRITICAL: You MUST write ALL fields (title, instructions, success_criteria, scaffolding_tips, reasoning) in HEBREW. The student and teacher speak Hebrew.'
      : 'CRITICAL: You MUST write ALL fields (title, instructions, success_criteria, scaffolding_tips, reasoning) in ENGLISH.';

    logInfo('Detected language for follow-up assignment', { language: detectedLanguage });

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

${languageInstruction}



CRITICAL INSTRUCTION REQUIREMENTS:
- Instructions must be EXACTLY 1 short paragraph (3-4 sentences maximum)
- NO lengthy introductions or preambles
- Get straight to what the student needs to do
- Be clear, direct, and actionable

The follow-up assignment should:
1. Address gaps or areas for growth identified in the feedback
2. Build on strengths demonstrated by the student
3. Set appropriate difficulty level based on student's demonstrated abilities:
   - "gentle_start": For students who struggled significantly - easy entry point, highly scaffolded
   - "moderate": For students with mixed performance - balanced challenge
   - "challenging": For students who excelled - push them further
4. Focus on specific learning dimensions that need attention
5. Provide clear, measurable success criteria (2-3 specific outcomes)
6. Include a brief scaffolding tip to help students get started

Return your response as a valid JSON object with the following structure:
{
  "title": "Assignment title (concise and engaging)",
  "instructions": "Direct, concise instructions in ONE paragraph (3-4 sentences max). NO introduction, just what to do.",
  "type": "text_essay",
  "difficulty_level": "gentle_start" | "moderate" | "challenging",
  "success_criteria": ["Specific outcome 1", "Specific outcome 2", "Specific outcome 3"],
  "scaffolding_tips": "1-2 sentence hint for getting started",
  "target_dimensions": {
    "vision": boolean,
    "values": boolean,
    "thinking": boolean,
    "connection": boolean,
    "action": boolean
  },
  "reasoning": "Brief explanation of why this assignment and difficulty level were chosen (1-2 sentences)"
}

The type should be one of: "text_essay", "file_upload", "quiz", "project"
Target dimensions should be set to true for the 1-3 dimensions this assignment primarily focuses on.
Difficulty level MUST match the student's demonstrated ability level.
Success criteria should be clear, specific, and measurable outcomes.`;

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
      800,
      'smart'
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

    // Ensure difficulty_level is valid
    const validDifficulties = ['gentle_start', 'moderate', 'challenging'];
    if (!validDifficulties.includes(assignmentData.difficulty_level)) {
      assignmentData.difficulty_level = 'moderate'; // Default fallback
    }

    // Ensure success_criteria is an array
    if (!Array.isArray(assignmentData.success_criteria)) {
      assignmentData.success_criteria = [];
    }

    // Ensure scaffolding_tips is a string
    if (typeof assignmentData.scaffolding_tips !== 'string') {
      assignmentData.scaffolding_tips = '';
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
      difficulty_level: assignmentData.difficulty_level,
    });

    return new Response(
      JSON.stringify({
        title: assignmentData.title,
        instructions: assignmentData.instructions,
        type: assignmentData.type,
        difficulty_level: assignmentData.difficulty_level,
        success_criteria: assignmentData.success_criteria,
        scaffolding_tips: assignmentData.scaffolding_tips,
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

