-- Initial greeting is prepended by perleap-chat (greetingPrefix). Stop instructing the model to output the same line again.

UPDATE ai_prompts
SET
  prompt_template = 'The student has ALREADY seen this exact introduction on screen (it was injected before your message). Do NOT output it again. Do NOT paraphrase it. The line they saw is:

Hello! I am Perleap, {{teacherName}}''s AI teaching assistant.

Your reply must continue from there: at most one short welcoming clause if needed, then IMMEDIATELY ask the first question from the assignment instructions.
Do NOT repeat your name or the teacher introduction. Do NOT add filler sentences. Do NOT ask "How are you?".',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction'
  AND language = 'en'
  AND is_active = true
  AND prompt_template NOT LIKE '%ALREADY seen this exact introduction on screen%';

UPDATE ai_prompts
SET
  prompt_template = 'לתלמיד כבר הוצג על המסך המשפט המדויק הבא (לפני התשובה שלך). אסור לך לכתוב אותו שוב. אסור לנסח אותו מחדש. המשפט שראו:

שלום! אני Perleap, עוזר ההוראה של {{teacherName}}.

המשך משם: לכל היותר משפט קצר וחם במידת הצורך, ואז שאל מיד את השאלה הראשונה מהוראות המשימה.
אל תחזור על שמך או על משפט הפתיחה. אל תוסיף משפטי מילוי. אל תשאל "מה שלומך?".',
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_greeting_instruction'
  AND language = 'he'
  AND is_active = true
  AND prompt_template NOT LIKE '%כבר הוצג על המסך המשפט המדויק הבא%';
