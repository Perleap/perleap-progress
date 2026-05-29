-- Display name: Live Session — teacher uploads an in-person session recording.
-- Reuses the assignment/submission/feedback pipeline so per-student evaluations flow into the 5D chart.

ALTER TYPE public.assignment_type ADD VALUE IF NOT EXISTS 'live_session';

COMMENT ON TYPE public.assignment_type IS 'Assignment types: text_essay, chatbot, questions, test, project, presentation, langchain, live_session (legacy: quiz_mcq, creative_task, discussion_prompt, multimedia)';
