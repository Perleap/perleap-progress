-- Manual Migration Script for 5D Dimensions
-- If the automatic migrations didn't run, execute this in Supabase SQL Editor

-- =====================================================
-- STEP 1: Add score_explanations column if not exists
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'five_d_snapshots' 
      AND column_name = 'score_explanations'
  ) THEN
    ALTER TABLE five_d_snapshots
    ADD COLUMN score_explanations JSONB DEFAULT NULL;
    
    COMMENT ON COLUMN five_d_snapshots.score_explanations IS 
      'AI-generated explanations for each 5D score: {vision: "...", values: "...", thinking: "...", connection: "...", action: "..."}';
    
    CREATE INDEX idx_five_d_snapshots_has_explanations 
      ON five_d_snapshots((score_explanations IS NOT NULL))
      WHERE score_explanations IS NOT NULL;
    
    RAISE NOTICE 'Added score_explanations column';
  ELSE
    RAISE NOTICE 'score_explanations column already exists';
  END IF;
END $$;

-- =====================================================
-- STEP 2: Migrate existing data from old to new dimensions
-- =====================================================
DO $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Only update rows that still have old dimension keys
  UPDATE five_d_snapshots
  SET scores = jsonb_build_object(
    'vision', COALESCE((scores->>'creative')::numeric, 5),
    'values', COALESCE((scores->>'emotional')::numeric, 5),
    'thinking', COALESCE((scores->>'cognitive')::numeric, 5),
    'connection', COALESCE((scores->>'social')::numeric, 5),
    'action', COALESCE((scores->>'behavioral')::numeric, 5)
  )
  WHERE scores ? 'cognitive' 
     OR scores ? 'emotional' 
     OR scores ? 'social' 
     OR scores ? 'creative' 
     OR scores ? 'behavioral';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % snapshots with new dimension keys', updated_count;
END $$;

-- =====================================================
-- STEP 3: Update default value for scores column
-- =====================================================
ALTER TABLE five_d_snapshots 
ALTER COLUMN scores SET DEFAULT '{"vision": 5, "values": 5, "thinking": 5, "connection": 5, "action": 5}';

COMMENT ON COLUMN five_d_snapshots.scores IS 
  '5D soft skills scores: vision, values, thinking, connection, action (0-10 scale)';

-- =====================================================
-- STEP 4: Update AI Prompts
-- =====================================================
UPDATE ai_prompts
SET 
  prompt_template = 'You are analyzing a student''s learning conversation to assess their soft skills development across five dimensions.

Analyze {{studentName}}''s conversation and rate them on a scale of 0-10 for each dimension:

**Vision:** Imagining new possibilities and bold ideas; creative, adaptive thinking
**Values:** Guided by ethics and integrity; building trust and understanding limits
**Thinking:** Strong analysis, deep insight, and sound judgment; critical and analytical skills
**Connection:** Empathy, clear communication, and effective collaboration
**Action:** Turning plans into results with focus, determination, and practical skills

Return ONLY a JSON object with scores (0-10):
{"vision": X, "values": X, "thinking": X, "connection": X, "action": X}',
  description = 'Prompt for generating 5D soft skills dimension scores from student conversations',
  updated_at = NOW()
WHERE prompt_key = 'five_d_scores';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
SELECT 
  'Migration Complete!' as status,
  COUNT(*) FILTER (WHERE scores ? 'vision') as new_format_count,
  COUNT(*) FILTER (WHERE scores ? 'cognitive') as old_format_count,
  COUNT(*) as total_snapshots
FROM five_d_snapshots;

