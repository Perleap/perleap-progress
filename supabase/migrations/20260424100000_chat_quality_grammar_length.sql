-- Grammar, length, and acronym rules for student chat; relax 2-3 to 2-4 sentences.
-- Idempotent: uses markers and strpos guards.

-- Relax concise rule (English)
UPDATE ai_prompts
SET
  prompt_template = REPLACE(
    prompt_template,
    '2-3 sentences MAX.',
    '2-4 short sentences MAX when needed for complete grammar (e.g. acknowledgment + transition + question).'
  ),
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_system_enhanced'
  AND language = 'en'
  AND is_active = true
  AND strpos(prompt_template, '2-3 sentences MAX.') > 0;

-- Relax concise rule (Hebrew)
UPDATE ai_prompts
SET
  prompt_template = REPLACE(
    prompt_template,
    E'2-3 משפטים לכל היותר.',
    E'2-4 משפטים קצרים לכל היותר כשצריך דקדוק מלא (למשל אישור + מעבר + שאלה).'
  ),
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_system_enhanced'
  AND language = 'he'
  AND is_active = true
  AND strpos(prompt_template, E'2-3 משפטים לכל היותר.') > 0;

-- Insert GRAMMAR AND LENGTH block after OUTPUT QUALITY (English)
UPDATE ai_prompts
SET
  prompt_template = REPLACE(
    prompt_template,
    E'*** OUTPUT QUALITY (HIGH PRIORITY) ***\n- Write complete, grammatically correct sentences (subject + verb); include articles and small words English requires (e.g. "a job description", "the next task").\n- Use normal spaces between words and in stage labels (e.g. "Stage 1", never "Stage1").\n- Keep product and proper names exactly as given in assignment or course materials.\n- If you ask more than one question, put a line break between your short lead-in and the questions.\n\n=== TEACHER''S VOICE & STYLE ===',
    E'*** OUTPUT QUALITY (HIGH PRIORITY) ***\n- Write complete, grammatically correct sentences (subject + verb); include articles and small words English requires (e.g. "a job description", "the next task").\n- Use normal spaces between words and in stage labels (e.g. "Stage 1", never "Stage1").\n- Keep product and proper names exactly as given in assignment or course materials.\n- If you ask more than one question, put a line break between your short lead-in and the questions.\n\n*** GRAMMAR AND LENGTH (HIGH PRIORITY) ***\n- You may use up to 4 short sentences when the reply includes acknowledgment, a transition, and a clear question; never omit auxiliaries, subjects, or verbs just to shorten the reply.\n- Questions must be grammatically complete (e.g. "Have you completed this step?", "Could you explain how the workflow works?").\n- Spell acronyms in full unless the assignment instructions define a different abbreviation (e.g. write "LLM integration", never truncated forms like a lone letter before "integration").\n- English punctuation: never put a space before a comma; write stage labels with a number or clear label (e.g. "Stage 1, where …"), not a comma immediately after "Stage" with nothing specified.\n\n=== TEACHER''S VOICE & STYLE ==='
  ),
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_system_enhanced'
  AND language = 'en'
  AND is_active = true
  AND prompt_template NOT LIKE '%GRAMMAR AND LENGTH (HIGH PRIORITY)%'
  AND strpos(
    prompt_template,
    E'*** OUTPUT QUALITY (HIGH PRIORITY) ***\n- Write complete, grammatically correct sentences (subject + verb); include articles and small words English requires (e.g. "a job description", "the next task").\n- Use normal spaces between words and in stage labels (e.g. "Stage 1", never "Stage1").\n- Keep product and proper names exactly as given in assignment or course materials.\n- If you ask more than one question, put a line break between your short lead-in and the questions.\n\n=== TEACHER''S VOICE & STYLE ==='
  ) > 0;

-- Insert דקדוק ואורך block after איכות ניסוח (Hebrew)
UPDATE ai_prompts
SET
  prompt_template = REPLACE(
    prompt_template,
    E'*** איכות ניסוח (עדיפות גבוהה) ***\n- כתוב משפטים שלמים ותקינים תחבירית; אל תדלג על מילות יחס או על מילות קישור שהשפה דורשת.\n- השתמש ברווחים רגילים בין מילים ובתוויות שלבים (למשל "שלב 1", לא "שלב1").\n- שמור על שמות מוצרים ושמות עצם כפי שמופיעים בהוראות או בחומרי הקורס.\n- אם אתה שואל יותר משאלה אחת, הוסף שורת רווח בין פסקת הפתיחה הקצרה לבין השאלות.\n\n=== קול וסגנון המורה ===',
    E'*** איכות ניסוח (עדיפות גבוהה) ***\n- כתוב משפטים שלמים ותקינים תחבירית; אל תדלג על מילות יחס או על מילות קישור שהשפה דורשת.\n- השתמש ברווחים רגילים בין מילים ובתוויות שלבים (למשל "שלב 1", לא "שלב1").\n- שמור על שמות מוצרים ושמות עצם כפי שמופיעים בהוראות או בחומרי הקורס.\n- אם אתה שואל יותר משאלה אחת, הוסף שורת רווח בין פסקת הפתיחה הקצרה לבין השאלות.\n\n*** דקדוק ואורך (עדיפות גבוהה) ***\n- מותר עד 4 משפטים קצרים כשהתגובה כוללת אישור, מעבר, ושאלה ברורה; אל תמחק מילות עזר, נושאים או פעלים רק כדי לקצר.\n- שאלות חייבות להיות תקינות תחבירית במלואן (למשל "האם השלמת את השלב?", "האם תוכל להסביר איך זה עובד?").\n- כתוב ראשי תיבות במלואם כפי שמופיע בהוראות המשימה; אל תקצר בצורה מבלבלת (למשל אל תכתוב אות בודדת לפני "שילוב" במקום LLM).\n- פיסוק: בלי רווח לפני פסיק; כתוב תווית שלב עם מספר או שם ברור (למשל "שלב 1, שבו …").\n\n=== קול וסגנון המורה ==='
  ),
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_system_enhanced'
  AND language = 'he'
  AND is_active = true
  AND prompt_template NOT LIKE '%דקדוק ואורך (עדיפות גבוהה)%'
  AND strpos(
    prompt_template,
    E'*** איכות ניסוח (עדיפות גבוהה) ***\n- כתוב משפטים שלמים ותקינים תחבירית; אל תדלג על מילות יחס או על מילות קישור שהשפה דורשת.\n- השתמש ברווחים רגילים בין מילים ובתוויות שלבים (למשל "שלב 1", לא "שלב1").\n- שמור על שמות מוצרים ושמות עצם כפי שמופיעים בהוראות או בחומרי הקורס.\n- אם אתה שואל יותר משאלה אחת, הוסף שורת רווח בין פסקת הפתיחה הקצרה לבין השאלות.\n\n=== קול וסגנון המורה ==='
  ) > 0;
