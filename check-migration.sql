-- Run this query in Supabase SQL Editor to check if migration was applied
-- This will show you if the assigned_student_id column exists

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assignments'
ORDER BY ordinal_position;

