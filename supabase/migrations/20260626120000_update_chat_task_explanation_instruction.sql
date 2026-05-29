-- Sync chat_task_explanation_instruction with tightened explain-task copy (replaces stale verbose templates).

UPDATE ai_prompts
SET
  prompt_template = E'TASK_EXPLANATION_GREETING (this turn only)\n- The student said they do NOT understand the assignment yet.\n- In at most 2 short sentences, explain what they must do using the official student task in <assignment>.\n- Do NOT ask them to answer the first sub-task yet; do NOT start tutoring questions until they signal readiness.\n- End with one brief check-for-understanding question.',
  version = version + 1,
  updated_at = now()
WHERE prompt_key = 'chat_task_explanation_instruction'
  AND language = 'en'
  AND is_active = true;

UPDATE ai_prompts
SET
  prompt_template = E'TASK_EXPLANATION_GREETING (תור זה בלבד)\n- התלמיד/ה ציין/ה שעדיין לא הבין/ה את המטלה.\n- בהרבה הכל במשפטיים קצרים, הסבירו מה נדרש לפי המשימה הרשמית ב-<assignment>.\n- אל תבקשו עדיין לענות על המשימה/תת-המשימה הראשונה; אל תתחילו שאלות הוראה עד שהתלמיד/ה מוכן/ה.\n- סיימו בשאלת הבנה קצרה אחת.',
  version = version + 1,
  updated_at = now()
WHERE prompt_key = 'chat_task_explanation_instruction'
  AND language = 'he'
  AND is_active = true;
