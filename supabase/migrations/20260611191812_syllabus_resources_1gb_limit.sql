-- Raise syllabus-resources bucket upload limit to 1 GB.
-- Note: project global file size limit (Dashboard → Project Settings → Storage) must also be >= 1 GB.

UPDATE storage.buckets
SET file_size_limit = 1073741824
WHERE id = 'syllabus-resources';
