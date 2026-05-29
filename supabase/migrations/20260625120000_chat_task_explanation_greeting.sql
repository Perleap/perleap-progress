-- Prompts for first-turn task explanation when the student clicks "No" on task understanding.

INSERT INTO ai_prompts (
  prompt_key,
  prompt_name,
  prompt_template,
  description,
  variables,
  version,
  language,
  is_active
) VALUES
(
  'chat_task_explanation_instruction',
  'Chat Task Explanation (EN)',
  E'TASK_EXPLANATION_GREETING (this turn only)\n- The student said they do NOT understand the assignment yet.\n- In at most 2 short sentences, explain what they must do using the official student task in <assignment>.\n- Do NOT ask them to answer the first sub-task yet; do NOT start tutoring questions until they signal readiness.\n- End with one brief check-for-understanding question.',
  'Appended to system prompt when initialGreetingMode is explain_task',
  '[]'::jsonb,
  1,
  'en',
  true
),
(
  'chat_task_explanation_instruction',
  'Chat Task Explanation (HE)',
  E'TASK_EXPLANATION_GREETING (תור זה בלבד)\n- התלמיד/ה ציין/ה שעדיין לא הבין/ה את המטלה.\n- בהרבה הכל במשפטיים קצרים, הסבירו מה נדרש לפי המשימה הרשמית ב-<assignment>.\n- אל תבקשו עדיין לענות על המשימה/תת-המשימה הראשונה; אל תתחילו שאלות הוראה עד שהתלמיד/ה מוכן/ה.\n- סיימו בשאלת הבנה קצרה אחת.',
  'Appended to system prompt when initialGreetingMode is explain_task (Hebrew)',
  '[]'::jsonb,
  1,
  'he',
  true
);
