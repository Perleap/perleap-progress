-- Ordered text/video blocks for lesson-type section_resources (v1 JSON in lesson_content)

ALTER TABLE public.section_resources
  ADD COLUMN IF NOT EXISTS lesson_content jsonb;

COMMENT ON COLUMN public.section_resources.lesson_content IS
  'lesson: { "version": 1, "blocks": [ ... ] }; null = legacy single body_text + url/file_path';

ALTER TABLE public.section_resources
  DROP CONSTRAINT IF EXISTS section_resources_lesson_has_content;

ALTER TABLE public.section_resources
  ADD CONSTRAINT section_resources_lesson_has_content
  CHECK (
    resource_type <> 'lesson'
    OR (
      (body_text IS NOT NULL AND btrim(body_text) <> '')
      OR file_path IS NOT NULL
      OR (url IS NOT NULL AND btrim(url) <> '')
      OR (
        lesson_content IS NOT NULL
        AND jsonb_typeof(lesson_content) = 'object'
        AND (lesson_content->>'version') = '1'
        AND jsonb_typeof(lesson_content->'blocks') = 'array'
        AND jsonb_array_length(lesson_content->'blocks') > 0
      )
    )
  );
