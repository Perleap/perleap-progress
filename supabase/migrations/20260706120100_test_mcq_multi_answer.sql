ALTER TABLE public.test_questions
  ADD COLUMN IF NOT EXISTS correct_option_ids JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS allow_multiple_selections BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.test_responses
  ADD COLUMN IF NOT EXISTS selected_option_ids JSONB NOT NULL DEFAULT '[]';

UPDATE public.test_questions
SET
  correct_option_ids = CASE
    WHEN correct_option_id IS NOT NULL THEN jsonb_build_array(correct_option_id)
    ELSE '[]'::jsonb
  END,
  allow_multiple_selections = false
WHERE correct_option_ids = '[]'::jsonb
  AND correct_option_id IS NOT NULL;

UPDATE public.test_responses
SET selected_option_ids = CASE
  WHEN selected_option_id IS NOT NULL THEN jsonb_build_array(selected_option_id)
  ELSE '[]'::jsonb
END
WHERE selected_option_ids = '[]'::jsonb
  AND selected_option_id IS NOT NULL;
