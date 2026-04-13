-- ============================================================================
-- Section content, flow control (release modes), and prerequisites
-- ============================================================================

-- 1. Add rich content column to syllabus_sections
ALTER TABLE public.syllabus_sections
  ADD COLUMN IF NOT EXISTS content text;

-- 2. Add prerequisite and lock columns to syllabus_sections
ALTER TABLE public.syllabus_sections
  ADD COLUMN IF NOT EXISTS prerequisites uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- 3. Add release_mode to syllabi
ALTER TABLE public.syllabi
  ADD COLUMN IF NOT EXISTS release_mode text NOT NULL DEFAULT 'all_at_once'
    CHECK (release_mode IN ('all_at_once', 'sequential', 'date_based', 'manual', 'prerequisites'));

-- 4. Index for efficient prerequisite lookups
CREATE INDEX IF NOT EXISTS idx_syllabus_sections_prerequisites
  ON public.syllabus_sections USING gin (prerequisites);
