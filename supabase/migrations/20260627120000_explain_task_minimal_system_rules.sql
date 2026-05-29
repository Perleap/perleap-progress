-- Merged explain-task rules for composeExplainTaskSystemPrompt (not appended to tutor skeleton).



UPDATE ai_prompts

SET

  prompt_template = E'TASK_EXPLANATION (this turn only)\n- The student said they do NOT understand the assignment yet.\n- In at most 2 short sentences, explain what they must do using only the official student task in <assignment>.\n- Do NOT ask them to answer the first sub-task yet; do NOT start tutoring questions until they signal readiness.\n- End with one brief check-for-understanding (yes/no or one clarifying question).\n- Example tone: "You need to add two numbers and show your work—we are not solving 1+1 yet."',

  description = 'Full behavioral rules for explain_task system prompt (used by composeExplainTaskSystemPrompt; not appended to tutor skeleton).',

  version = version + 1,

  updated_at = now()

WHERE prompt_key = 'chat_task_explanation_instruction'

  AND language = 'en'

  AND is_active = true;



UPDATE ai_prompts

SET

  prompt_template = E'TASK_EXPLANATION (תור זה בלבד)\n- התלמיד/ה ציין/ה שעדיין לא הבין/ה את המטלה.\n- בעד 2 משפטים קצרים, הסבירו מה נדרש לפי המשימה הרשמית ב-<assignment> בלבד.\n- אל תבקשו עדיין לענות על תת-המשימה הראשונה; אל תתחילו שאלות הוראה עד שהתלמיד/ה מוכן/ה.\n- סיימו בבדיקת הבנה קצרה אחת (כן/לא או שאלת הבהרה אחת).\n- דוגמה לטון: "צריך לחבר שני מספרים ולהראות את הדרך—עדיין לא פותרים 1+1."',

  description = 'Full behavioral rules for explain_task system prompt (used by composeExplainTaskSystemPrompt; not appended to tutor skeleton).',

  version = version + 1,

  updated_at = now()

WHERE prompt_key = 'chat_task_explanation_instruction'

  AND language = 'he'

  AND is_active = true;

