-- Track the most recent OpenAI Responses API response id per conversation, so subsequent
-- turns can use previous_response_id chaining (smaller payload, faster) instead of replaying
-- the full message history. Used only when PERLEAP_CHAT_USE_RESPONSES_API=true.

ALTER TABLE assignment_conversations
  ADD COLUMN IF NOT EXISTS last_openai_response_id TEXT;

NOTIFY pgrst, 'reload schema';
