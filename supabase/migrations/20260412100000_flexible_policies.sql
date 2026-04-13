-- ============================================================================
-- Flexible Policies: replace 4 hardcoded policy text columns with a single
-- JSONB array column so teachers can pick-and-choose which policies to add.
-- ============================================================================

-- 1. Add the new JSONB column
ALTER TABLE public.syllabi
  ADD COLUMN IF NOT EXISTS policies jsonb NOT NULL DEFAULT '[]';

-- 2. Migrate existing data from the 4 text columns into the new JSONB array
UPDATE public.syllabi
SET policies = (
  SELECT coalesce(jsonb_agg(entry ORDER BY entry->>'order_index'), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', t.policy_type,
      'label', t.policy_label,
      'content', t.policy_content,
      'order_index', t.idx
    ) AS entry
    FROM (
      VALUES
        (grading_policy_text,       'grading',       'Grading Policy',       0),
        (attendance_policy_text,    'attendance',    'Attendance Policy',    1),
        (late_work_policy_text,     'late_work',     'Late Work Policy',     2),
        (communication_policy_text, 'communication', 'Communication Policy', 3)
    ) AS t(policy_content, policy_type, policy_label, idx)
    WHERE t.policy_content IS NOT NULL AND t.policy_content <> ''
  ) sub
)
WHERE grading_policy_text IS NOT NULL
   OR attendance_policy_text IS NOT NULL
   OR late_work_policy_text IS NOT NULL
   OR communication_policy_text IS NOT NULL;

-- 3. Drop the old columns
ALTER TABLE public.syllabi DROP COLUMN IF EXISTS grading_policy_text;
ALTER TABLE public.syllabi DROP COLUMN IF EXISTS attendance_policy_text;
ALTER TABLE public.syllabi DROP COLUMN IF EXISTS late_work_policy_text;
ALTER TABLE public.syllabi DROP COLUMN IF EXISTS communication_policy_text;
