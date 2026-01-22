-- Add voice_preference to student_profiles
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS voice_preference TEXT DEFAULT 'shimmer';

-- Add a check constraint to ensure only valid voices are used
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_voice_preference'
    ) THEN
        ALTER TABLE student_profiles ADD CONSTRAINT check_voice_preference CHECK (voice_preference IN ('shimmer', 'onyx', 'alloy', 'echo', 'fable', 'nova'));
    END IF;
END $$;
