-- Create storage bucket for assignment materials (PDFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-materials', 'assignment-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for assignment materials
-- Teachers can upload materials to their own assignments
CREATE POLICY "Teachers can upload assignment materials"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'assignment-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Teachers can view their own assignment materials
CREATE POLICY "Teachers can view their assignment materials"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'assignment-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Teachers can delete their own assignment materials
CREATE POLICY "Teachers can delete their assignment materials"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'assignment-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Students enrolled in a classroom can view assignment materials
-- This will be handled at the application level by using public URLs
-- since we set the bucket as public

