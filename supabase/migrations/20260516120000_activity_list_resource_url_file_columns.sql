-- Ensure activity_list (formerly section_resources) has file/link columns.
-- Some environments returned PostgREST PGRST204: "Could not find the 'url' column".

ALTER TABLE public.activity_list
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint;

COMMENT ON COLUMN public.activity_list.url IS 'External link for resource_type link; may mirror public storage URL for uploaded files.';
COMMENT ON COLUMN public.activity_list.file_path IS 'Object path in syllabus-resources bucket for uploaded files.';
