-- Explain-task message ends with the first task question (no readiness step).
-- Add a spacing reminder to both explain-task and post-explain tutor rules.

UPDATE ai_prompts
SET
  prompt_template = E'TASK_EXPLANATION (this turn only)\n- The student already said they do NOT understand the assignment. Do NOT ask "Do you understand?" or similar comprehension quizzes.\n- In 2 short sentences, explain the overall goal in everyday language using only <assignment>. Prefer one holistic summary, not a sub-task checklist (e.g. "You''ll practice basic add, multiply, and subtract with small numbers").\n- End the message by asking the first task from <assignment> directly (e.g. "What is 1 + 1?"). Do NOT add a "ready to start" transition.\n- Always put a single space between words; never glue words together (e.g. never write "thesame" — always "the same").\n- Still at most 3 sentences total, plain prose, no lists.',
  version = version + 1,
  updated_at = now()
WHERE prompt_key = 'chat_task_explanation_instruction'
  AND language = 'en'
  AND is_active = true;

UPDATE ai_prompts
SET
  prompt_template = E'TASK_EXPLANATION (תור זה בלבד)\n- התלמיד/ה כבר אמר/ה שעדיין לא הבין/ה את המטלה. אל תשאלו "הבנת?" או בדיקות הבנה דומות.\n- ב-2 משפטים קצרים, הסבירו את המטרה הכללית בשפה יומיומית לפי <assignment> בלבד. העדיפו סיכום כולל ולא רשימת תת-משימות (למשל "תתרגלו חיבור, כפל וחיסור עם מספרים קטנים").\n- סיימו את ההודעה בשאלה של המשימה הראשונה מ-<assignment> ישירות (למשל "כמה זה 1 + 1?"). אל תוסיפו מעבר של "ספרו לי כשאתם מוכנים".\n- שמרו תמיד על רווח אחד בין מילים; אל תדביקו מילים (למשל לעולם לא "thesame" — תמיד "the same").\n- עד 3 משפטים בסך הכל, פרוזה פשוטה, בלי רשימות.',
  version = version + 1,
  updated_at = now()
WHERE prompt_key = 'chat_task_explanation_instruction'
  AND language = 'he'
  AND is_active = true;

UPDATE ai_prompts
SET
  prompt_template = E'POST_EXPLAIN_TUTOR (overrides scaffolding in TUTOR_TURN_PROTOCOL for this submission)\n- The student already received a plain-language overview of the whole assignment on the first message.\n- Do NOT re-teach each sub-task with analogies or step-by-step lessons before asking (no "1+1 means one finger plus another" unless they ask).\n- For each turn: target the FIRST INCOMPLETE task in <task_progress>; ask that task directly in the final sentence.\n- If the answer is correct: brief acknowledgment (one short sentence), then ask the next INCOMPLETE task.\n- If the answer is wrong: one short hint only, then re-ask the SAME task (no lecture).\n- If they ask for help or say they don''t understand a specific part: explain only that part briefly, then re-ask.\n- Always put a single space between words; never glue words together (e.g. never write "thesame" — always "the same").\n- Still at most 3 sentences, plain prose, no lists; still append <<<PROGRESS:[...]>>>; still use COMPLETION_PROTOCOL when all tasks done.',
  version = version + 1,
  updated_at = now()
WHERE prompt_key = 'chat_post_explain_tutor_instruction'
  AND language = 'en'
  AND is_active = true;

UPDATE ai_prompts
SET
  prompt_template = E'POST_EXPLAIN_TUTOR (גובר על פיגום ב-TUTOR_TURN_PROTOCOL להגשה זו)\n- התלמיד/ה כבר קיבל/ה סקירה בשפה פשוטה של כל המטלה בהודעה הראשונה.\n- אל תלמדו מחדש כל תת-משימה באנלוגיות או שיעור שלב-אחר-שלב לפני השאלה (לא "1+1 זה אצבע ועוד אצבע" אלא אם מבקשים).\n- בכל תור: כוונו למשימה הראשונה שמסומנת INCOMPLETE ב-<task_progress>; שאלו אותה ישירות במשפט האחרון.\n- תשובה נכונה: אישור קצר (משפט אחד), ואז השאלה על המשימה הבאה ש-INCOMPLETE.\n- תשובה שגויה: רמז קצר אחד בלבד, ואז שאלו שוב את אותה משימה (בלי הרצאה).\n- אם מבקשים עזרה או שלא מבינים חלק מסוים: הסבירו רק את החלק הזה בקצרה, ואז שאלו שוב.\n- שמרו תמיד על רווח אחד בין מילים; אל תדביקו מילים (למשל לעולם לא "thesame" — תמיד "the same").\n- עדיין עד 3 משפטים, פרוזה פשוטה, בלי רשימות; עדיין <<<PROGRESS:[...]>>>; עדיין COMPLETION_PROTOCOL כשהכל הושלם.',
  version = version + 1,
  updated_at = now()
WHERE prompt_key = 'chat_post_explain_tutor_instruction'
  AND language = 'he'
  AND is_active = true;
