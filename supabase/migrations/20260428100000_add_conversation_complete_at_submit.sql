-- Whether the student had reached in-app "conversation ended" (green banner) when they completed the submission.
-- NULL = not applicable (non–chat-primary flow or pre-migration); true = chat flow complete; false = completed early.
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS conversation_complete_at_submit boolean;

COMMENT ON COLUMN public.submissions.conversation_complete_at_submit IS
  'Chat assignments: true if conversationEnded at submit; false if student completed before that; NULL if N/A.';
