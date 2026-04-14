-- Syllabus section file uploads (see src/services/syllabusResourceService.ts)
-- Path shape: {syllabus_section_id}/{timestamp}-{random}.{ext}

INSERT INTO storage.buckets (id, name, public)
VALUES ('syllabus-resources', 'syllabus-resources', true)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public = true
WHERE id = 'syllabus-resources';

-- Public reads so getPublicUrl() works for students without a JWT on the asset request
DROP POLICY IF EXISTS "Public read syllabus resources" ON storage.objects;
CREATE POLICY "Public read syllabus resources"
ON storage.objects
FOR SELECT
USING (bucket_id = 'syllabus-resources');

-- Teachers may upload only under a syllabus section they manage (first path segment = section id)
DROP POLICY IF EXISTS "Teachers can upload syllabus section resources" ON storage.objects;
CREATE POLICY "Teachers can upload syllabus section resources"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'syllabus-resources'
  AND EXISTS (
    SELECT 1
    FROM public.syllabus_sections ss
    JOIN public.syllabi y ON y.id = ss.syllabus_id
    WHERE ss.id::text = (storage.foldername(name))[1]
      AND public.is_classroom_teacher(y.classroom_id, (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "Teachers can delete syllabus section resources" ON storage.objects;
CREATE POLICY "Teachers can delete syllabus section resources"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'syllabus-resources'
  AND EXISTS (
    SELECT 1
    FROM public.syllabus_sections ss
    JOIN public.syllabi y ON y.id = ss.syllabus_id
    WHERE ss.id::text = (storage.foldername(name))[1]
      AND public.is_classroom_teacher(y.classroom_id, (SELECT auth.uid()))
  )
);
