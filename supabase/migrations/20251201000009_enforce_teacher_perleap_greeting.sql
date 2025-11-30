-- Enforce specific greeting format: "Hello, I'm [Teacher]'s Perleap"
-- This updates the chat_greeting_instruction for both English and Hebrew to strictly follow this format
-- and immediately ask the first question.

-- 1. English Greeting Instruction
UPDATE ai_prompts
SET 
  prompt_template = 'You MUST start the conversation exactly like this:
"Hello, I''m {{teacherName}}''s Perleap."

Then, immediately allow the student to answer or ask the first question derived from the assignment instructions.
Do NOT ask "How are you?" or generic pleasantries.
Start directly with the learning content after the greeting.',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'en';

-- 2. Hebrew Greeting Instruction
UPDATE ai_prompts
SET 
  prompt_template = 'עליך להתחיל את השיחה בדיוק כך:
"שלום, אני הפרליפ של {{teacherName}}."

לאחר מכן, מיד שאל את השאלה הראשונה הנגזרת מהוראות המשימה.
אל תשאל "מה שלומך?" או שאלות נימוס כלליות.
התחל מיד עם תוכן הלימוד לאחר הברכה.',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'he';

