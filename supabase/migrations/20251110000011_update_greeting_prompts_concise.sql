-- Update greeting prompts to ensure concise initial greetings
-- This ensures the initial greeting and instructions are also short and concise

-- Update the greeting instruction to be concise
UPDATE ai_prompts
SET 
  prompt_template = 'You must start your response with: "Hello I''m {{teacherName}}''s perleap" and then continue with a BRIEF warm greeting (1-2 sentences only). DO NOT use emojis.',
  version = version + 1,
  updated_at = now()
WHERE prompt_key = 'chat_greeting_instruction';

-- Update the after greeting instruction to be concise
UPDATE ai_prompts
SET 
  prompt_template = 'After introducing yourself, briefly acknowledge the assignment topic in 1-2 sentences and ask the student ONE simple question to begin. Remember: NO emojis. Keep it SHORT.',
  version = version + 1,
  updated_at = now()
WHERE prompt_key = 'chat_after_greeting';

-- Add comment
COMMENT ON TABLE ai_prompts IS 'Updated greeting prompts to be more concise';

