-- Add score_explanations column to five_d_snapshots table
-- This will store AI-generated explanations for each dimension score

ALTER TABLE five_d_snapshots
ADD COLUMN score_explanations JSONB DEFAULT NULL;

-- Add comment to document the column
COMMENT ON COLUMN five_d_snapshots.score_explanations IS 'AI-generated explanations for each 5D score: {vision: "...", values: "...", thinking: "...", connection: "...", action: "..."}';

-- Create index for better query performance (optional, since we mainly use this column for display)
CREATE INDEX idx_five_d_snapshots_has_explanations ON five_d_snapshots((score_explanations IS NOT NULL))
WHERE score_explanations IS NOT NULL;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully added score_explanations column to five_d_snapshots table';
END $$;

