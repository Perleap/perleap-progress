-- PR-SEC-RLS: private avatar buckets; authenticated read only (no anonymous hotlinking).

UPDATE storage.buckets SET public = false WHERE id IN ('student-avatars', 'teacher-avatars');

DROP POLICY IF EXISTS "Anyone can view student avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view teacher avatars" ON storage.objects;

CREATE POLICY "Authenticated users can view student avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'student-avatars');

CREATE POLICY "Authenticated users can view teacher avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'teacher-avatars');
