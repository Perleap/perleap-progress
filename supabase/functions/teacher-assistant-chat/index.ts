import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createChatCompletion, handleOpenAIError } from '../shared/openai.ts';
import { persistEdgeFunctionLog, errorToStack } from '../shared/persistEdgeFunctionLog.ts';
import { queueOpikTrace, uuidv7 } from '../shared/opikTrace.ts';

function lastUserMessageContent(messages: unknown): string {
    if (!Array.isArray(messages)) return '';
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i] as { role?: string; content?: unknown };
        if (m?.role !== 'user') continue;
        const c = m.content;
        if (typeof c === 'string') return c;
        if (Array.isArray(c)) return JSON.stringify(c);
        if (c === null || c === undefined) return '';
        return JSON.stringify(c);
    }
    return '';
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a helpful, professional AI Assistant for teachers using the PerLeap platform.
Your goal is to assist teachers with education-related tasks, such as:
- Lesson planning and curriculum design.
- Creating and refining assignments, quizzes, and rubrics.
- Differentiation strategies for diverse learners.
- Classroom management advice.
- Analyzing student progress and interpreting data.
- Drafting feedback for students.

STRICT SCOPE POLICY:
- You must ONLY discuss topics related to education, teaching, learning, and the PerLeap platform.
- If the user asks about off-topic subjects (e.g., politics, cryptocurrency, entertainment, personal advice requiring a therapist, unrelated coding), you MUST politely refuse.
- Refusal template: "I apologize, but I am designed to assist with teaching and education-related topics only. How can I help you with your classroom or lesson planning?"
- Do not engage in the off-topic conversation even if asked to "pretend".

CONTEXT usage:
- You will be provided with some context about the teacher's current view (route) and their classes. Use this to be more helpful.
- If the teacher is on a specific classroom page, assume their questions might be about that class unless specified otherwise.
`;

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { messages, context } = body;
        const threadId =
            (typeof body.threadId === 'string' && body.threadId.trim()) ||
            (typeof body.conversationId === 'string' && body.conversationId.trim()) ||
            crypto.randomUUID();
        const clientTraceId = uuidv7();
        const userTurn = lastUserMessageContent(messages);

        const systemPrompt = `${SYSTEM_PROMPT}\n\nCURRENT CONTEXT:\n${JSON.stringify(context, null, 2)}`;

        const traceStartMs = Date.now();
        const { content, usage } = await createChatCompletion(
            systemPrompt,
            messages,
            0.7,
            1000,
            'smart'
        ) as { content: string; usage?: unknown };
        const traceEndMs = Date.now();

        void queueOpikTrace({
            traceName: 'teacher-assistant-chat.reply',
            tags: ['teacher-assistant-chat', 'teacher', 'edge-function'],
            threadId,
            clientTraceId,
            traceStartMs,
            traceEndMs,
            userMessage: userTurn,
            assistantMessage: content,
            openaiUsage: usage,
            metadata: {
                edge_function: 'teacher-assistant-chat',
                model_tier: 'smart',
                context_route: typeof context?.route === 'string' ? context.route : undefined,
            },
        }).catch(() => undefined);

        return new Response(JSON.stringify({ message: content }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const message = handleOpenAIError(error);
        await persistEdgeFunctionLog(
            {
                functionName: 'teacher-assistant-chat',
                level: 'error',
                httpStatus: 500,
                message,
                stack: errorToStack(error),
            },
            req,
        );
        return new Response(
            JSON.stringify({ error: message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
        );
    }
});
