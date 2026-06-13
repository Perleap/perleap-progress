-- Allow multiple uploaded files per project submission
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS file_urls text[];

UPDATE public.submissions
SET file_urls = ARRAY[file_url]
WHERE file_url IS NOT NULL
  AND (file_urls IS NULL OR cardinality(file_urls) = 0);
