-- Clean up duplicate prompts in ai_prompts table
-- Keep only the most recent version for each (prompt_key, language, is_active) combination

-- First, identify and keep only the latest version of each prompt
WITH ranked_prompts AS (
  SELECT 
    id,
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

-- Add a comment to document the cleanup
COMMENT ON TABLE ai_prompts IS 'AI prompts table - cleaned up duplicates on 2025-11-11';

-- Ensure the constraint is properly in place to prevent future duplicates
-- The constraint should already exist from previous migrations
DO $$ 
BEGIN
  -- Check if constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ai_prompts_prompt_key_language_key'
  ) THEN
    -- Add composite unique constraint to prevent future duplicates
    ALTER TABLE ai_prompts 
      ADD CONSTRAINT ai_prompts_prompt_key_language_key 
      UNIQUE (prompt_key, language);
  END IF;
END $$;

