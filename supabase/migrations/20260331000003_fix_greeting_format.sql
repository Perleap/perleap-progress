-- Fix greeting: AI keeps dropping "for" from "the AI assistant for {name}".
-- Use a simpler sentence structure that can't be misquoted.

UPDATE ai_prompts
SET
  prompt_template = 'Your first message MUST begin with this EXACT sentence (copy it word-for-word, only replacing {{teacherName}} with the teacher name):

Hello! I am Perleap, {{teacherName}}''s AI teaching assistant.

Do NOT rephrase, shorten, or reword the sentence above. Output it exactly as written.
After this sentence, IMMEDIATELY ask the first question from the assignment instructions.
Do NOT add filler sentences. Do NOT ask "How are you?".',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'en';

UPDATE ai_prompts
SET
  prompt_template = 'ההודעה הראשונה שלך חייבת להתחיל עם המשפט המדויק הזה (העתק מילה במילה, רק החלף את {{teacherName}} בשם המורה):

שלום! אני פרליפ, עוזר ההוראה של {{teacherName}}.

אל תנסח מחדש, תקצר או תשנה את המשפט למעלה. כתוב אותו בדיוק כפי שהוא.
לאחר משפט זה, שאל מיד את השאלה הראשונה מהוראות המשימה.
אל תוסיף משפטי מילוי. אל תשאל "מה שלומך?".',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'he';
