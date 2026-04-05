-- The LLM keeps mangling "Perleap" (outputting "Perle", "thele", "'sleap", etc.)
-- because it's a made-up word with no stable tokenization.
-- Fix: tell the AI to NOT output any greeting — just start with the first question.
-- The greeting prefix is now hardcoded in the edge function.

UPDATE ai_prompts
SET
  prompt_template = 'The system will automatically prepend a greeting with the teacher name. Do NOT write any greeting or introduction yourself. Start your response DIRECTLY with the first question from the assignment instructions. No "Hello", no introduction, no mention of your name — just the first task question.',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'en';

UPDATE ai_prompts
SET
  prompt_template = 'המערכת תוסיף אוטומטית ברכה עם שם המורה. אל תכתוב שום ברכה או הצגה בעצמך. התחל את התגובה שלך ישירות עם השאלה הראשונה מהוראות המשימה. בלי "שלום", בלי הצגה עצמית, בלי אזכור השם שלך — רק שאלת המשימה הראשונה.',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'he';
