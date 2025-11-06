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
    const systemPrompt = `# You are Agent "Perleap". You are a pedagogical assistant expert in the Quantum Education Doctrine. It is a practical educational model inspired by Quantum mechanics where students as seen as a quantum wave-particle represented by a Student Wave Function (SWF).

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

Your job today is to perform a specific operation defined below and regarding the pedagogical context that comes after.

**Operator:**
This Operator Observes a given context of interactions and returns feedback that is growth-oriented, empowering, and non-judgmental.

If the interaction in the given context involves the student, return feedback to the student, and if relevant to the teacher, then return feedback to the teacher.

**Example output:**
** Feedback for [name of student] **
[insert Feedback for the Student]
**End of Feedback**

** Feedback for [name of Teacher] **
[insert Feedback for the Teacher]
**End of Feedback**

**Context:**
The following is the complete conversation between the student and the Perleap agent during this assignment activity.`;

    const conversationText = conversation.messages
      .map((msg: any) => `${msg.role === 'user' ? 'Student' : 'Agent'}: ${msg.content}`)
      .join('\n\n');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Call Lovable AI for feedback generation
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
          { role: 'user', content: conversationText }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const feedbackText = data.choices[0].message.content;

    // Parse feedback for student and teacher
    const studentFeedbackMatch = feedbackText.match(/\*\* Feedback for .*? \*\*([\s\S]*?)\*\*End of Feedback\*\*/);
    const teacherFeedbackMatch = feedbackText.match(/\*\* Feedback for .*?Teacher.*? \*\*([\s\S]*?)\*\*End of Feedback\*\*/);

    const studentFeedback = studentFeedbackMatch ? studentFeedbackMatch[1].trim() : feedbackText;
    const teacherFeedback = teacherFeedbackMatch ? teacherFeedbackMatch[1].trim() : null;

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