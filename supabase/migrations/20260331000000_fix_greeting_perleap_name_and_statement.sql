-- Fix two bugs in chat_greeting_instruction:
--
-- Bug 1: "Dor Abookasis'sleap" instead of "Dor Abookasis's Perleap"
--   GPT tokenizes `'s Perleap` as `'s` + `Per` + `leap`.
--   When the teacher name ends in 's' (e.g. "Abookasis"), the model conflates
--   the possessive `'s` with the following token and drops `Per`, producing `'sleap`.
--   Fix: rewrite as "the Perleap of {{teacherName}}" — no possessive + compound word collision.
--
-- Bug 2: AI opens with a warm statement before jumping to the first task question
--   Introduced by 20251201000010_warmer_greeting.sql which added:
--   "Add a short, warm, welcoming sentence immediately after"
--   This caused the model to insert filler text (e.g. "excited to work with you!")
--   as a statement BEFORE the first assignment question.
--   Fix: remove that instruction and restore the strict "immediately ask the first question" behaviour.

-- ==========================================
-- 1. ENGLISH
-- ==========================================
UPDATE ai_prompts
SET
  prompt_template = 'You MUST start the conversation with EXACTLY this greeting:
"Hello! I''m the Perleap of {{teacherName}}."

After the greeting, IMMEDIATELY ask the first question derived from the assignment instructions.
Do NOT add any warm filler sentence between the greeting and the first question.
Do NOT ask "How are you?" or any generic pleasantries.
Start the learning content right after the greeting line.',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'en';

-- ==========================================
-- 2. HEBREW
-- ==========================================
UPDATE ai_prompts
SET
  prompt_template = 'עליך להתחיל את השיחה בדיוק עם הברכה הבאה:
"שלום! אני הפרליפ של {{teacherName}}."

לאחר הברכה, שאל מיד את השאלה הראשונה הנגזרת מהוראות המשימה.
אל תוסיף משפט ממלא חמים בין הברכה לשאלה הראשונה.
אל תשאל "מה שלומך?" או שאלות נימוס כלליות.
התחל את תוכן הלמידה מיד לאחר שורת הברכה.',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction' AND language = 'he';
