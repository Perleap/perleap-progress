-- Create AI Prompts Table
-- This table stores all AI system prompts used throughout the application
-- for better maintainability and dynamic updates without code changes

CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT UNIQUE NOT NULL,
  prompt_name TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  description TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on prompt_key for fast lookups
CREATE INDEX idx_ai_prompts_key ON ai_prompts(prompt_key);
CREATE INDEX idx_ai_prompts_active ON ai_prompts(is_active);

-- Add RLS policies
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access to ai_prompts"
  ON ai_prompts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read active prompts
CREATE POLICY "Authenticated users can read active prompts"
  ON ai_prompts
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_prompts_updated_at
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_prompts_updated_at();

-- Add comment
COMMENT ON TABLE ai_prompts IS 'Stores AI system prompts for dynamic management';
COMMENT ON COLUMN ai_prompts.prompt_key IS 'Unique identifier for the prompt (e.g., chat_system, feedback_generation)';
COMMENT ON COLUMN ai_prompts.prompt_template IS 'The actual prompt template with {{variable}} placeholders';
COMMENT ON COLUMN ai_prompts.variables IS 'JSON array of variable names expected in the template';
COMMENT ON COLUMN ai_prompts.version IS 'Version number for tracking prompt changes';

