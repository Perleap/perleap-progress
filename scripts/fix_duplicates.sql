-- Quick fix for duplicate ai_prompts
-- Run this in your Supabase SQL Editor to clean up duplicates immediately

-- Show current duplicates
SELECT prompt_key, language, is_active, COUNT(*) as count
FROM ai_prompts
GROUP BY prompt_key, language, is_active
HAVING COUNT(*) > 1;

-- Delete duplicates, keeping only the most recent version
WITH ranked_prompts AS (
  SELECT 
    id,
    prompt_key,
    language,
    version,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY prompt_key, language, is_active 
      ORDER BY version DESC, created_at DESC
    ) as rn
  FROM ai_prompts
)
DELETE FROM ai_prompts
WHERE id IN (
  SELECT id FROM ranked_prompts WHERE rn > 1
);

-- Verify cleanup worked
SELECT prompt_key, language, is_active, COUNT(*) as count
FROM ai_prompts
GROUP BY prompt_key, language, is_active
HAVING COUNT(*) > 1;
-- This should return 0 rows after cleanup

