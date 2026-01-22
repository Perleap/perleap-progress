-- Update course-materials bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'course-materials';

-- Ensure students and others can view course materials
-- This is already handled by the bucket being public, 
-- but we can add an explicit policy for clarity if needed.
-- The existing "Teachers can view their course materials" policy is for authenticated teachers.
-- For a public bucket, we usually don't need a SELECT policy if we want it truly public,
-- but Supabase RLS still applies to storage.objects.

CREATE POLICY "Public Access to Course Materials"
ON storage.objects
FOR SELECT
USING (bucket_id = 'course-materials');
