import { createChatCompletion } from '../shared/openai.ts';

const COMPLETION_MARKER = '[CONVERSATION_COMPLETE]';

const EDITOR_SYSTEM_EN = `You are a copy editor for an educational chat assistant.

Your ONLY job is to fix grammar, spelling, and punctuation in the user's message, and to restore small missing words (such as auxiliaries or articles) needed for complete, natural sentences.

STRICT RULES:
- Do NOT change pedagogical meaning, task order, facts, or what the student is being asked to do.
- Do NOT add new tasks, questions, or requirements that were not already implied.
- Do NOT add a transition to the next task if the draft only corrects an invalid image or proof (image-mismatch replies must stay focused on the current task).
- Preserve the exact substring ${COMPLETION_MARKER} if it appears; keep it at the very end if it was at the end of the draft.
- If the draft is Hebrew, output Hebrew; if English, output English. Match the draft language.
- Output ONLY the edited message text. No preface, no quotes, no markdown unless the draft already used it.`;

const EDITOR_SYSTEM_HE = `אתה עורך לשון של הודעות מערכת חינוכית.

תפקידך הבלעדי: לתקן דקדוק, איות ופיסוק, ולהשלים מילים קטנות חסרות שנדרשות למשפטים שלמים וטבעיים.

כללים קפדניים:
- אל תשנה משמעות פדגוגית, סדר משימות, עובדות או מה שמבקשים מהתלמיד.
- אל תוסיף משימות, שאלות או דרישות חדשות שלא הופיעו בטיוטה.
- אל תוסיף מעבר למשימה הבאה אם הטיוטה מתקנת רק תמונה/הוכחה לא תקינה (התמקדות במשימה הנוכחית בלבד).
- שמור בדיוק על המחרוזת ${COMPLETION_MARKER} אם היא מופיעה; אם הייתה בסוף הטיוטה, השאר אותה בסוף.
- אם הטיוטה בעברית, פלט עברית; אם באנגלית, פלט אנגלית.
- פלט רק את הטקסט הערוך. בלי הקדמה, בלי מרכאות.`;

/**
 * Low-temperature copy-edit pass. Never throws; returns draft on failure or unsafe edit.
 */
export async function polishAssistantDraft(draft: string, language: string): Promise<string> {
  const trimmed = draft.trim();
  if (!trimmed) return draft;

  const systemPrompt = language === 'he' ? EDITOR_SYSTEM_HE : EDITOR_SYSTEM_EN;
  const userContent =
    language === 'he'
      ? `ערוך את הטקסט הבא. החזר רק את הגרסה המתוקנת:\n\n${draft}`
      : `Edit the following draft. Return only the corrected text:\n\n${draft}`;

  try {
    const { content } = (await createChatCompletion(
      systemPrompt,
      [{ role: 'user', content: userContent }],
      0.15,
      1200,
      'smart',
    )) as { content: string };

    const polished = (content ?? '').trim();
    if (!polished) return draft;

    const draftHasMarker = draft.toUpperCase().includes(COMPLETION_MARKER);
    const polishedHasMarker = polished.toUpperCase().includes(COMPLETION_MARKER);
    if (draftHasMarker && !polishedHasMarker) return draft;

    return polished;
  } catch {
    return draft;
  }
}
