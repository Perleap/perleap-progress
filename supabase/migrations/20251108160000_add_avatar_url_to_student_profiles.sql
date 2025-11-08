-- Add avatar_url column to student_profiles table
ALTER TABLE public.student_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for student avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-avatars', 'student-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for student avatars
CREATE POLICY "Students can upload their own avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'student-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Anyone can view student avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'student-avatars');

CREATE POLICY "Students can update their own avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'student-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can delete their own avatars"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'student-avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

