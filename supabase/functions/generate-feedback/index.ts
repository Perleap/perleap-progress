/**
 * Generate Feedback - OpenAI Integration
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
    const { submissionId, studentId, assignmentId, studentName, teacherName } = await req.json();
    console.log('Generate feedback request:', { submissionId, studentId, assignmentId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get conversation context - get the most recent one if multiple exist
    const { data: conversations, error: convError } = await supabase
      .from('assignment_conversations')
      .select('*')
      .eq('submission_id', submissionId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (convError) {
      console.error('Error fetching conversation:', convError);
      throw convError;
    }

    if (!conversations || conversations.length === 0) {
      console.error('No conversation found for submission:', submissionId);
      throw new Error('No conversation found for this submission. Please ensure you have chatted with Perleap before completing the activity.');
    }

    const conversation = conversations[0];
    console.log('Found conversation ID:', conversation.id, 'with messages count:', conversation.messages?.length || 0);

    if (!conversation.messages || conversation.messages.length === 0) {
      console.error('Conversation has no messages:', submissionId);
      throw new Error('No conversation messages found. Please chat with Perleap before completing the activity.');
    }

    // Prepare feedback generation prompt
    // Generate feedback using Quantum Education Doctrine
    const feedbackPrompt = `# You are Agent "Perleap". You are a pedagogical assistant expert in the Quantum Education Doctrine. It is a practical educational model inspired by Quantum mechanics where students are seen as a quantum wave-particle represented by a Student Wave Function (SWF).

## The Student Wave Function (SWF): it consists of 2 Tables of parameters.

**1. The Soft Related Abilities**
Are a set of five dimensions that span the entire spectrum of human soft abilities.

**2. The Content Related Abilities (CRA)**
Are specific, content-related, and technical skills or sets of knowledge that pertain to a particular domain, subject, or field.

---

Here is a general example for a Student Wave Function of a student:

**Soft Table:**
| Dimension (Color) | Developmental Stage Number (D) | Motivational Level Number (M) | Leap Probability Number (L) | Mindset Phase Number (P) | Overall Context (C) |
|-------------------|-------------------------------|-------------------------------|----------------------------|----------------------------|--------------------|
| Cognitive (White) | [1-100: Development Level] | [1-100: Motivation Level] | [1-100%: Leap Probability] | [Up/Down: Current Mindset] | [Short textual description of overall state in this dimension] |
| ... | ... | ... | ... | ... | ... |

**Content Table:**
| Area/Domain | K/S Component | Current Level (CL) | Actionable Challenges (AC) |
|-------------|---------------|--------------------|----------------------------|
| [Domain 1: Specific Area of Content] | [Component 1.1: Specific Knowledge or Skill] | [X% - Brief description of proficiency level] | [Challenge or task related to Component 1.1] |
| ... | ... | ... | ... |

---

**Operator: Feedback**

This Operator observes a given context of interactions and returns feedback that is growth-oriented, empowering, and non-judgmental.

You must generate TWO separate feedbacks based on the conversation:

**1. Feedback for ${studentName} (the student):**
- Growth-oriented, encouraging, and empowering
- Celebrate their insights, progress, and effort
- Highlight what they did well
- Gently point out areas for growth without judgment
- Inspire them to continue learning
- Focus on building confidence
- Keep the pedagogical framework in mind but don't make it explicit

**2. Feedback for ${teacherName} (the teacher):**
- Professional pedagogical insights about ${studentName}'s performance
- What the student did well (strengths demonstrated)
- What the student struggled with (areas needing support)
- Specific suggestions on how to help this student improve
- Observations about the student's learning style, engagement level, and thinking patterns
- Actionable recommendations for personalized instruction
- Note any misconceptions or gaps in understanding
- Reference the Quantum Education Doctrine framework where appropriate

**IMPORTANT: You MUST follow this exact format:**

** Feedback for ${studentName} **
[Write encouraging, student-facing feedback here - 2-3 paragraphs]
**End of Feedback**

** Feedback for ${teacherName} **
[Write professional, teacher-facing insights and recommendations here - 2-3 paragraphs]
**End of Feedback**

**Context:**
The following is the complete conversation between ${studentName} and the educational agent during this assignment activity.`;

    console.log('Found conversation with', conversation.messages.length, 'messages');
    
    const conversationText = conversation.messages
      .map((msg: any) => `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`)
      .join('\n\n');
    
    console.log('Conversation text length:', conversationText.length, 'characters');

    // Get OpenAI configuration
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY environment variable not set');
      throw new Error('OPENAI_API_KEY not configured. Please set the environment variable in Supabase settings.');
    }
    console.log('OpenAI API key configured:', OPENAI_API_KEY ? 'Yes' : 'No');

    // Get model from environment or use default
    const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4-turbo-preview';
    console.log('Using OpenAI model:', OPENAI_MODEL);

    // Call OpenAI for feedback generation
    console.log('Calling OpenAI for feedback generation...');
    const feedbackResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: feedbackPrompt },
          { role: 'user', content: conversationText }
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!feedbackResponse.ok) {
      const errorText = await feedbackResponse.text();
      console.error('OpenAI API error:', feedbackResponse.status, errorText);
      
      // Parse OpenAI error for better error messages
      try {
        const errorData = JSON.parse(errorText);
        const errorMessage = errorData.error?.message || errorText;
        throw new Error(`OpenAI API error (${feedbackResponse.status}): ${errorMessage}`);
      } catch {
        throw new Error(`OpenAI API error: ${feedbackResponse.status}`);
      }
    }

    const feedbackData = await feedbackResponse.json();
    const feedbackText = feedbackData.choices[0].message.content;

    // Log token usage for monitoring
    if (feedbackData.usage) {
      console.log('OpenAI token usage (feedback):', feedbackData.usage);
    }

    console.log('Feedback generated successfully, parsing...');
    console.log('Raw feedback text (first 500 chars):', feedbackText.substring(0, 500));
    
    // Parse feedback for student and teacher
    // Match the first feedback block (student)
    const studentFeedbackMatch = feedbackText.match(/\*\* Feedback for .*? \*\*([\s\S]*?)\*\*End of Feedback\*\*/);
    
    // Match the second feedback block (teacher) - more flexible pattern
    // This will match any second feedback block after the first one
    const allFeedbackBlocks = feedbackText.match(/\*\* Feedback for .*? \*\*([\s\S]*?)\*\*End of Feedback\*\*/g);
    
    let studentFeedback = '';
    let teacherFeedback = null;
    
    if (allFeedbackBlocks && allFeedbackBlocks.length >= 2) {
      // Extract content from first block (student)
      const studentMatch = allFeedbackBlocks[0].match(/\*\* Feedback for .*? \*\*([\s\S]*?)\*\*End of Feedback\*\*/);
      studentFeedback = studentMatch ? studentMatch[1].trim() : feedbackText;
      
      // Extract content from second block (teacher)
      const teacherMatch = allFeedbackBlocks[1].match(/\*\* Feedback for .*? \*\*([\s\S]*?)\*\*End of Feedback\*\*/);
      teacherFeedback = teacherMatch ? teacherMatch[1].trim() : null;
    } else if (studentFeedbackMatch) {
      // Only one block found, use it as student feedback
      studentFeedback = studentFeedbackMatch[1].trim();
      console.log('Warning: Only one feedback block found, expected two');
    } else {
      // No proper format, use entire text as student feedback
      studentFeedback = feedbackText;
      console.log('Warning: Could not parse feedback format, using raw text');
    }
    
    console.log('Parsed student feedback length:', studentFeedback.length);
    console.log('Parsed teacher feedback:', teacherFeedback ? `Yes (${teacherFeedback.length} chars)` : 'No');
    
    if (!teacherFeedback) {
      console.error('Teacher feedback not found! Full feedback text:', feedbackText);
    }

    // Generate 5D analysis using Activity operator
    const activityPrompt = `You are analyzing a student's learning conversation to assess their 5D development across five dimensions.

Analyze ${studentName}'s conversation and rate them on a scale of 0-10 for each dimension:

**Cognitive (White):** Analytical thinking, problem-solving, understanding of concepts, critical reasoning
**Emotional (Red):** Self-awareness, emotional regulation, resilience, growth mindset
**Social (Blue):** Communication skills, collaboration, perspective-taking, empathy
**Creative (Yellow):** Innovation, original thinking, curiosity, exploration
**Behavioral (Green):** Task completion, persistence, self-direction, responsibility

Return ONLY a JSON object with scores (0-10):
{"cognitive": X, "emotional": X, "social": X, "creative": X, "behavioral": X}`;

    // Call OpenAI for 5D scores analysis
    console.log('Calling OpenAI for 5D scores...');
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
      console.error('Scores API call failed:', scoresResponse.status);
    }

    // Save 5D snapshot with 'assignment' source and link to submission
    console.log('Saving 5D snapshot to database...');
    const { error: snapshotError } = await supabase
      .from('five_d_snapshots')
      .insert({
        user_id: studentId,
        scores,
        source: 'assignment',
        submission_id: submissionId
      });

    if (snapshotError) {
      console.error('Error saving snapshot:', snapshotError);
      // Don't throw - continue to save feedback
    } else {
      console.log('5D snapshot saved successfully');
    }

    // Save feedback
    console.log('Saving feedback to database...');
    const { error: feedbackError } = await supabase
      .from('assignment_feedback')
      .insert({
        submission_id: submissionId,
        student_id: studentId,
        assignment_id: assignmentId,
        student_feedback: studentFeedback,
        teacher_feedback: teacherFeedback,
        conversation_context: conversation.messages
      });

    if (feedbackError) {
      console.error('Error saving feedback to database:', feedbackError);
      throw feedbackError;
    }

    console.log('Feedback saved successfully, returning response');
    
    return new Response(JSON.stringify({ 
      studentFeedback,
      teacherFeedback 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in generate-feedback:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});