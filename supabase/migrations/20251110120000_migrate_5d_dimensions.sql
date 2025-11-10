-- Migrate 5D dimensions from old names to new names
-- Old: cognitive, emotional, social, creative, behavioral
-- New: vision, values, thinking, connection, action

-- Update five_d_snapshots scores JSONB column
-- Map: cognitive -> thinking, emotional -> values, social -> connection, creative -> vision, behavioral -> action
UPDATE five_d_snapshots
SET scores = jsonb_build_object(
  'vision', COALESCE((scores->>'creative')::numeric, 5),
  'values', COALESCE((scores->>'emotional')::numeric, 5),
  'thinking', COALESCE((scores->>'cognitive')::numeric, 5),
  'connection', COALESCE((scores->>'social')::numeric, 5),
  'action', COALESCE((scores->>'behavioral')::numeric, 5)
)
WHERE scores ? 'cognitive' OR scores ? 'emotional' OR scores ? 'social' OR scores ? 'creative' OR scores ? 'behavioral';

-- Update default value in table definition
ALTER TABLE five_d_snapshots 
ALTER COLUMN scores SET DEFAULT '{"vision": 5, "values": 5, "thinking": 5, "connection": 5, "action": 5}';

-- Add comment to document the change
COMMENT ON COLUMN five_d_snapshots.scores IS '5D soft skills scores: vision, values, thinking, connection, action (0-10 scale)';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully migrated 5D dimensions to new naming: vision, values, thinking, connection, action';
END $$;

