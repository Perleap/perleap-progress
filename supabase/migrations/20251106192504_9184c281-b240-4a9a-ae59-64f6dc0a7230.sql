-- Add course details columns to classrooms table
ALTER TABLE public.classrooms
ADD COLUMN IF NOT EXISTS course_title TEXT,
ADD COLUMN IF NOT EXISTS course_duration TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS course_outline TEXT,
ADD COLUMN IF NOT EXISTS resources TEXT,
ADD COLUMN IF NOT EXISTS learning_outcomes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS key_challenges JSONB DEFAULT '[]'::jsonb;

-- Create storage bucket for course materials
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-materials', 'course-materials', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for course materials
CREATE POLICY "Teachers can upload course materials"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'course-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can view their course materials"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'course-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can delete their course materials"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'course-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);