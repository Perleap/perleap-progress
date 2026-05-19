-- chat_system_enhanced is no longer fetched at runtime: the Edge function composes the
-- tutor system prompt entirely in code (see supabase/functions/_shared/composeSystemPrompt.ts).
-- Shrink the DB rows to a stub so the admin UI shows the new source of truth.

UPDATE ai_prompts
SET
  prompt_template = $STUB_EN$
[Replaced by code-side composer]

This DB template is no longer used at runtime. The Perleap tutor system prompt is now built
entirely in `supabase/functions/_shared/composeSystemPrompt.ts`, using the canonical skeleton
exported from `supabase/functions/shared/perleapChatCompletionRules.ts`
(see PERLEAP_CHAT_SKELETON_BY_LANG / getPerleapChatSkeleton).

The composer emits an XML-tagged structure:
  <teacher_style>, <learner_preferences>, <task_and_hard_skills>,
  <course_materials>, <assignment>, <prior_context>

To update tutor rules, edit perleapChatCompletionRules.ts and redeploy the Edge function.
$STUB_EN$,
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_system_enhanced' AND language = 'en';

UPDATE ai_prompts
SET
  prompt_template = $STUB_HE$
[הוחלף ביצירה צד-קוד]

תבנית זו אינה בשימוש בזמן ריצה יותר. הפרומפט של מערכת ה-AI Perleap נבנה כעת לחלוטין ב-
`supabase/functions/_shared/composeSystemPrompt.ts`, באמצעות השלד הקנוני שמיוצא מ-
`supabase/functions/shared/perleapChatCompletionRules.ts`
(ראה PERLEAP_CHAT_SKELETON_BY_LANG / getPerleapChatSkeleton).

ה-composer מפיק מבנה מתויג XML:
  <teacher_style>, <learner_preferences>, <task_and_hard_skills>,
  <course_materials>, <assignment>, <prior_context>

לעדכון חוקי המורה, ערוך את perleapChatCompletionRules.ts ופרוס מחדש את פונקציית ה-Edge.
$STUB_HE$,
  version = version + 1,
  updated_at = NOW()
WHERE prompt_key = 'chat_system_enhanced' AND language = 'he';

NOTIFY pgrst, 'reload schema';
