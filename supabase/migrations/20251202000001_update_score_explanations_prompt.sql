-- Update score explanations prompt to include reasoning and examples
-- This migration updates both English and Hebrew versions to maintain consistency

-- Update English version
UPDATE public.ai_prompts
SET 
  prompt_template = 'You are an expert educator analyzing a student''s learning conversation to provide actionable insights for their teacher.

STUDENT CONVERSATION:
{{conversationText}}

SCORES ASSIGNED:
{{scoresContext}}

For each dimension, write a specific explanation that:
1. References concrete examples from the student''s actual responses
2. Explains what they did well or what they struggled with
3. Provides the REASONING behind the score
4. Includes a specific EXAMPLE from the interaction that demonstrates this

CRITICAL: Where appropriate and insightful, include both reasoning and examples. Not every dimension needs both, but include them when they add value to understanding the student''s performance.

Be specific - quote or paraphrase what the student said. Avoid generic statements.

Return ONLY a JSON object with explanations (2-3 sentences each, including reasoning and/or examples where relevant):
{"vision": "...", "values": "...", "thinking": "...", "connection": "...", "action": "..."}

Ensure the keys exactly match the dimension names above.',
  updated_at = NOW()
WHERE prompt_key = 'score_explanations' 
  AND language = 'en';

-- Update Hebrew version
UPDATE public.ai_prompts
SET 
  prompt_template = 'אתה מחנך מומחה המנתח שיחת למידה של תלמיד כדי לספק תובנות מעשיות למורה שלו.

שיחת התלמיד:
{{conversationText}}

ציונים שהוקצו:
{{scoresContext}}

עבור כל ממד, כתוב הסבר ספציפי ש:
1. מתייחס לדוגמאות קונקרטיות מהתשובות האמיתיות של התלמיד
2. מסביר מה עשו טוב או עם מה התקשו
3. מספק את הנימוק (REASONING) מאחורי הציון
4. כולל דוגמה (EXAMPLE) ספציפית מהאינטראקציה שמדגימה זאת

קריטי: כאשר זה מתאים ותורם תובנה, כלול גם נימוק וגם דוגמאות. לא כל ממד צריך את שניהם, אבל כלול אותם כאשר הם מוסיפים ערך להבנת הביצועים של התלמיד.

היה ספציפי - צטט או נסח מחדש את מה שהתלמיד אמר. הימנע מהצהרות כלליות.

החזר רק אובייקט JSON עם הסברים (2-3 משפטים כל אחד, כולל נימוק ו/או דוגמאות כאשר רלוונטי) בעברית:
{"vision": "...", "values": "...", "thinking": "...", "connection": "...", "action": "..."}

ודא שהמפתחות תואמים בדיוק לשמות הממדים באנגלית (vision, values, thinking, connection, action) אך הערכים (ההסברים) בעברית.',
  updated_at = NOW()
WHERE prompt_key = 'score_explanations' 
  AND language = 'he';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully updated score_explanations prompts for both English and Hebrew';
END $$;

