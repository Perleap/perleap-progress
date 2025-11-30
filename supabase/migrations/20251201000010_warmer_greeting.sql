-- Make the greeting warmer while maintaining the "Perleap of [Teacher]" identity
-- Updates chat_greeting_instruction for both English and Hebrew

-- 1. English Greeting Instruction (Warmer)
UPDATE ai_prompts
SET 
  prompt_template = 'You MUST start the conversation with:
"Hello! I''m {{teacherName}}''s Perleap."

Add a short, warm, welcoming sentence immediately after (e.g., "I''m excited to work with you!" or "Happy to see you here.").

Then, immediately allow the student to answer or ask the first question derived from the assignment instructions.
Do NOT ask generic "How are you?" questions.',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'en';

-- 2. Hebrew Greeting Instruction (Warmer)
UPDATE ai_prompts
SET 
  prompt_template = 'עליך להתחיל את השיחה עם:
"שלום! אני הפרליפ של {{teacherName}}."

הוסף משפט קצר, חם ומזמין מיד לאחר מכן (למשל: "איזה כיף לעבוד איתך!" או "שמח לפגוש אותך כאן.").

לאחר מכן, שאל מיד את השאלה הראשונה הנגזרת מהוראות המשימה.
אל תשאל שאלות כלליות כמו "מה שלומך?".',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'he';

