-- Fix run-on sentences in the AI's first question after the greeting.
-- The "2-3 sentences MAX" rule was causing the AI to merge multiple
-- clauses without punctuation.

UPDATE ai_prompts
SET
  prompt_template = 'The system will automatically prepend a greeting. Do NOT write any greeting or introduction yourself.
Start your response DIRECTLY with the first task question from the assignment instructions.
Use proper punctuation. Each sentence must end with a period, question mark, or exclamation mark before starting a new sentence.',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'en';

UPDATE ai_prompts
SET
  prompt_template = 'המערכת תוסיף אוטומטית ברכה. אל תכתוב שום ברכה או הצגה בעצמך.
התחל את התגובה שלך ישירות עם שאלת המשימה הראשונה מהוראות המשימה.
השתמש בפיסוק תקין. כל משפט חייב להסתיים בנקודה, סימן שאלה או סימן קריאה לפני תחילת משפט חדש.',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'he';
