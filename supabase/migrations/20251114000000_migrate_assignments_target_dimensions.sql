-- Migrate assignments target_dimensions from old 5D names to new 5D names
-- Old: cognitive, emotional, social, creative, behavioral
-- New: vision, values, thinking, connection, action
-- Mapping: cognitive -> thinking, emotional -> values, social -> connection, creative -> vision, behavioral -> action

-- Update existing assignments to use new dimension names
UPDATE public.assignments
SET target_dimensions = jsonb_build_object(
  'vision', COALESCE((target_dimensions->>'creative')::boolean, false),
  'values', COALESCE((target_dimensions->>'emotional')::boolean, false),
  'thinking', COALESCE((target_dimensions->>'cognitive')::boolean, false),
  'connection', COALESCE((target_dimensions->>'social')::boolean, false),
  'action', COALESCE((target_dimensions->>'behavioral')::boolean, false)
)
WHERE target_dimensions ? 'cognitive' OR target_dimensions ? 'emotional' OR target_dimensions ? 'social' OR target_dimensions ? 'creative' OR target_dimensions ? 'behavioral';

-- Update default value for target_dimensions column
ALTER TABLE public.assignments 
ALTER COLUMN target_dimensions SET DEFAULT '{"vision": false, "values": false, "thinking": false, "connection": false, "action": false}';

-- Add comment to document the change
COMMENT ON COLUMN public.assignments.target_dimensions IS '5D soft skills dimensions targeted by this assignment: vision, values, thinking, connection, action';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully migrated assignments target_dimensions to new 5D naming: vision, values, thinking, connection, action';
END $$;

