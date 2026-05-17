-- Reinforce: deterministic greetingPrefix already appears; model must not add another "Welcome."

UPDATE ai_prompts
SET
  prompt_template = prompt_template || E'\n\nNever begin your reply with the word "Welcome" (the introduction is already on screen).',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction'
  AND language = 'en'
  AND is_active = true
  AND prompt_template NOT LIKE '%Never begin your reply with the word "Welcome"%';

UPDATE ai_prompts
SET
  prompt_template = prompt_template || E'\n\nאל תתחיל את התשובה במילה Welcome או בפתיחה "ברוך הבא" (ההקדמה כבר על המסך).',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction'
  AND language = 'he'
  AND is_active = true
  AND prompt_template NOT LIKE '%אל תתחיל את התשובה במילה Welcome%';
