-- Add high-priority output quality rules to student chat prompts (grammar, spacing, formatting).
-- Idempotent: skips rows that already contain the marker.

UPDATE ai_prompts
SET
  prompt_template = REPLACE(
    prompt_template,
    E'*** END OF CRITICAL RULES ***\n\n=== TEACHER''S VOICE & STYLE ===',
    E'*** END OF CRITICAL RULES ***\n\n*** OUTPUT QUALITY (HIGH PRIORITY) ***\n- Write complete, grammatically correct sentences (subject + verb); include articles and small words English requires (e.g. "a job description", "the next task").\n- Use normal spaces between words and in stage labels (e.g. "Stage 1", never "Stage1").\n- Keep product and proper names exactly as given in assignment or course materials.\n- If you ask more than one question, put a line break between your short lead-in and the questions.\n\n=== TEACHER''S VOICE & STYLE ==='
  ),
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_system_enhanced'
  AND language = 'en'
  AND is_active = true
  AND prompt_template NOT LIKE '%OUTPUT QUALITY (HIGH PRIORITY)%'
  AND strpos(
    prompt_template,
    E'*** END OF CRITICAL RULES ***\n\n=== TEACHER''S VOICE & STYLE ==='
  ) > 0;

UPDATE ai_prompts
SET
  prompt_template = REPLACE(
    prompt_template,
    E'*** סוף כללים קריטיים ***\n\n=== קול וסגנון המורה ===',
    E'*** סוף כללים קריטיים ***\n\n*** איכות ניסוח (עדיפות גבוהה) ***\n- כתוב משפטים שלמים ותקינים תחבירית; אל תדלג על מילות יחס או על מילות קישור שהשפה דורשת.\n- השתמש ברווחים רגילים בין מילים ובתוויות שלבים (למשל "שלב 1", לא "שלב1").\n- שמור על שמות מוצרים ושמות עצם כפי שמופיעים בהוראות או בחומרי הקורס.\n- אם אתה שואל יותר משאלה אחת, הוסף שורת רווח בין פסקת הפתיחה הקצרה לבין השאלות.\n\n=== קול וסגנון המורה ==='
  ),
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_system_enhanced'
  AND language = 'he'
  AND is_active = true
  AND prompt_template NOT LIKE '%איכות ניסוח (עדיפות גבוהה)%'
  AND strpos(
    prompt_template,
    E'*** סוף כללים קריטיים ***\n\n=== קול וסגנון המורה ==='
  ) > 0;
