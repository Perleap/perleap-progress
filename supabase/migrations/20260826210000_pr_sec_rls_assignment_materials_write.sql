-- Restore write policies for assignment-materials bucket (SELECT-only was added in 20260825200000)

CREATE POLICY "Teachers can upload assignment materials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assignment-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Teachers can update assignment materials"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assignment-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'assignment-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Teachers can delete assignment materials"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'assignment-materials'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
