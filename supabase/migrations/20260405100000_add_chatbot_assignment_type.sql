-- Display name: Chatbot — same runtime behavior as "questions" (conversation-based)

ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'chatbot';

COMMENT ON TYPE public.assignment_type IS 'Assignment types: text_essay, chatbot, questions, test, project, presentation, langchain (legacy: quiz_mcq, creative_task, discussion_prompt, multimedia)';
