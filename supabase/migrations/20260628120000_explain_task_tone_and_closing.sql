-- Explain-task tone: plain-language goal, no comprehension quiz, supportive closing.



UPDATE ai_prompts

SET

  prompt_template = E'TASK_EXPLANATION (this turn only)\n- The student already said they do NOT understand the assignment. Do NOT ask "Do you understand?" or similar comprehension quizzes.\n- In 2-3 short sentences, explain the overall goal in everyday language using only <assignment>.\n- Do NOT enumerate every sub-task or operator unless the assignment is a single task; prefer one holistic summary (e.g. "You''ll practice basic add, multiply, and subtract with small numbers").\n- Do NOT ask them to solve anything yet; no tutoring questions.\n- Close with a supportive invitation such as "Tell me when you''re ready to start" or "Which part should I explain more?" — not yes/no comprehension checks.\n- Example tone: "You''ll work through a few quick arithmetic problems with small numbers—we won''t solve them together until you''re ready."',

  version = version + 1,

  updated_at = now()

WHERE prompt_key = 'chat_task_explanation_instruction'

  AND language = 'en'

  AND is_active = true;



UPDATE ai_prompts

SET

  prompt_template = E'TASK_EXPLANATION (תור זה בלבד)\n- התלמיד/ה כבר אמר/ה שעדיין לא הבין/ה את המטלה. אל תשאלו "הבנת?" או בדיקות הבנה דומות.\n- ב-2-3 משפטים קצרים, הסבירו את המטרה הכללית בשפה יומיומית לפי <assignment> בלבד.\n- אל תפרטו כל תת-משימה או כל סימן פעולה, אלא אם המטלה היא משימה אחת; העדיפו סיכום כולל (למשל "תתרגלו חיבור, כפל וחיסור עם מספרים קטנים").\n- אל תבקשו לפתור עדיין; בלי שאלות הוראה.\n- סיימו בהזמנה תומכת כמו "ספרו לי כשאתם מוכנים להתחיל" או "איזה חלק לפרט עוד?" — לא בדיקת כן/לא.\n- דוגמה לטון: "תעברו כמה תרגילי חשבון קצרים עם מספרים קטנים—לא נפתור יחד עד שתהיו מוכנים."',

  version = version + 1,

  updated_at = now()

WHERE prompt_key = 'chat_task_explanation_instruction'

  AND language = 'he'

  AND is_active = true;

