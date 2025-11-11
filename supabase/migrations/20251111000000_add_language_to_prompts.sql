-- Add language column to ai_prompts table
ALTER TABLE ai_prompts ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Update existing prompts to have 'en' language
UPDATE ai_prompts SET language = 'en' WHERE language IS NULL;

-- Drop the old unique constraint on prompt_key only
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_prompts_prompt_key_key') THEN
    ALTER TABLE ai_prompts DROP CONSTRAINT ai_prompts_prompt_key_key;
  END IF;
END $$;

-- Add new composite unique constraint on (prompt_key, language)
ALTER TABLE ai_prompts ADD CONSTRAINT ai_prompts_prompt_key_language_key UNIQUE (prompt_key, language);

-- Create index on language column for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompts_language ON ai_prompts(language);

-- Add composite index for prompt_key and language lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompts_key_language ON ai_prompts(prompt_key, language);

-- Add preferred_language to student and teacher profiles
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

