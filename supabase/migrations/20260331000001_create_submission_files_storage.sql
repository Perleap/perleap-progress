-- Create storage bucket for student submission files
INSERT INTO storage.buckets (id, name, public)
VALUES ('submission-files', 'submission-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for submission files
-- Students can upload their own files to their submission folder
CREATE POLICY "Students can upload submission files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submission-files'
);

-- Anyone can view submission files (since it's a public bucket)
-- Or we could restrict it to teachers and the student themselves
CREATE POLICY "Anyone can view submission files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'submission-files'
);
