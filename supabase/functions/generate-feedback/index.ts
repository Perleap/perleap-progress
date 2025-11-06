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

    // Get conversation context
    const { data: conversation, error: convError } = await supabase
      .from('assignment_conversations')
      .select('*')
      .eq('submission_id', submissionId)
      .single();

    if (convError) {
      console.error('Error fetching conversation:', convError);
      throw convError;
    }

    // Prepare feedback generation prompt
    // Generate feedback
    const feedbackPrompt = `You are a pedagogical assistant analyzing a student's learning conversation. Provide growth-oriented, empowering feedback.

**Context:** The following is the complete conversation between ${studentName} and an educational agent during an assignment activity.

Return feedback in this format:
** Feedback for ${studentName} **
[Your feedback here]
**End of Feedback**

** Feedback for ${teacherName} **
[Your feedback here]
**End of Feedback**`;

    const conversationText = conversation.messages
      .map((msg: any) => `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`)
      .join('\n\n');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Call Lovable AI for feedback generation
    const feedbackResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: feedbackPrompt },
          { role: 'user', content: conversationText }
        ],
      }),
    });

    if (!feedbackResponse.ok) {
      const errorText = await feedbackResponse.text();
      console.error('AI API error:', feedbackResponse.status, errorText);
      throw new Error(`AI API error: ${feedbackResponse.status}`);
    }

    const feedbackData = await feedbackResponse.json();
    const feedbackText = feedbackData.choices[0].message.content;

    // Parse feedback for student and teacher
    const studentFeedbackMatch = feedbackText.match(/\*\* Feedback for .*? \*\*([\s\S]*?)\*\*End of Feedback\*\*/);
    const teacherFeedbackMatch = feedbackText.match(/\*\* Feedback for .*?Teacher.*? \*\*([\s\S]*?)\*\*End of Feedback\*\*/);

    const studentFeedback = studentFeedbackMatch ? studentFeedbackMatch[1].trim() : feedbackText;
    const teacherFeedback = teacherFeedbackMatch ? teacherFeedbackMatch[1].trim() : null;

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
      try {
        const parsed = JSON.parse(scoresText.replace(/```json\n?|\n?```/g, '').trim());
        scores = parsed;
      } catch (e) {
        console.error('Failed to parse scores:', e);
      }
    }

    // Save 5D snapshot
    const { error: snapshotError } = await supabase
      .from('five_d_snapshots')
      .insert({
        user_id: studentId,
        scores,
        source: 'assignment_completion'
      });

    if (snapshotError) {
      console.error('Error saving snapshot:', snapshotError);
    }

    // Save feedback
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
      console.error('Error saving feedback:', feedbackError);
      throw feedbackError;
    }

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