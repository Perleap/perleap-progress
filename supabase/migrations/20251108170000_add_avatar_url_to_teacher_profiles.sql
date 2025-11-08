-- Add avatar_url column to teacher_profiles table
ALTER TABLE public.teacher_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for teacher avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-avatars', 'teacher-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for teacher avatars
CREATE POLICY "Teachers can upload their own avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'teacher-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view teacher avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'teacher-avatars');

CREATE POLICY "Teachers can update their own avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'teacher-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can delete their own avatars"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'teacher-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

