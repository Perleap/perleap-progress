-- Verification script for 5D dimension migration
-- Run this in your Supabase SQL Editor to check if migrations are applied

-- 1. Check if score_explanations column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'five_d_snapshots' 
  AND column_name = 'score_explanations';

-- 2. Check current default value for scores column
SELECT pg_get_expr(adbin, adrelid) as default_value
FROM pg_attrdef
JOIN pg_attribute ON pg_attribute.attrelid = pg_attrdef.adrelid 
  AND pg_attribute.attnum = pg_attrdef.adnum
JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
WHERE pg_class.relname = 'five_d_snapshots'
  AND pg_attribute.attname = 'scores';

-- 3. Sample a few snapshots to see if they have new dimension keys
SELECT 
  id,
  scores,
  score_explanations,
  created_at
FROM five_d_snapshots
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check if AI prompts are updated
SELECT 
  prompt_key,
  prompt_name,
  LEFT(prompt_template, 200) as prompt_preview
FROM ai_prompts
WHERE prompt_key = 'five_d_scores';

-- 5. Count snapshots with old vs new dimension keys
SELECT 
  COUNT(*) FILTER (WHERE scores ? 'cognitive') as old_format_count,
  COUNT(*) FILTER (WHERE scores ? 'vision') as new_format_count,
  COUNT(*) as total_count
FROM five_d_snapshots;

