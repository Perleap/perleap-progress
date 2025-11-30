-- Seed score explanations prompt
INSERT INTO public.ai_prompts (prompt_key, prompt_name, prompt_template, description, variables, is_active, version, language)
VALUES
  -- English
  (
    'score_explanations',
    'Score Explanations Prompt (English)',
    'You are an expert educator analyzing a student''s learning conversation to provide actionable insights for their teacher.

STUDENT CONVERSATION:
{{conversationText}}

SCORES ASSIGNED:
{{scoresContext}}

For each dimension, write a specific explanation that:
1. References concrete examples from the student''s actual responses
2. Explains what they did well or what they struggled with
3. Provides actionable insight for the teacher

Be specific - quote or paraphrase what the student said. Avoid generic statements.

Return ONLY a JSON object with concise explanations (1-2 sentences each):
{"vision": "...", "values": "...", "thinking": "...", "connection": "...", "action": "..."}

Ensure the keys exactly match the dimension names above.',
    'Prompt for generating explanations for 5D scores',
    '["conversationText", "scoresContext"]'::jsonb,
    true,
    1,
    'en'
  ),
  -- Hebrew
  (
    'score_explanations',
    'Score Explanations Prompt (Hebrew)',
    'אתה מחנך מומחה המנתח שיחת למידה של תלמיד כדי לספק תובנות מעשיות למורה שלו.

שיחת התלמיד:
{{conversationText}}

ציונים שהוקצו:
{{scoresContext}}

עבור כל ממד, כתוב הסבר ספציפי ש:
1. מתייחס לדוגמאות קונקרטיות מהתשובות האמיתיות של התלמיד
2. מסביר מה עשו טוב או עם מה התקשו
3. מספק תובנה מעשית למורה

היה ספציפי - צטט או נסח מחדש את מה שהתלמיד אמר. הימנע מהצהרות כלליות.

החזר רק אובייקט JSON עם הסברים תמציתיים (1-2 משפטים כל אחד) בעברית:
{"vision": "...", "values": "...", "thinking": "...", "connection": "...", "action": "..."}

ודא שהמפתחות תואמים בדיוק לשמות הממדים באנגלית (vision, values, thinking, connection, action) אך הערכים (ההסברים) בעברית.',
    'הנחיה ליצירת הסברים לציוני 5D בעברית',
    '["conversationText", "scoresContext"]'::jsonb,
    true,
    1,
    'he'
  )
ON CONFLICT (prompt_key, language)
DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  updated_at = NOW();

