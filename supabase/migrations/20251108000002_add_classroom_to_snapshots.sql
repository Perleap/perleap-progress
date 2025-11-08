-- Add classroom_id to five_d_snapshots to track progress per classroom
-- This ensures students can have different 5D progress in different classrooms

-- Add the classroom_id column
ALTER TABLE public.five_d_snapshots
ADD COLUMN classroom_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE;

-- Create index for better query performance when filtering by classroom
CREATE INDEX idx_five_d_snapshots_classroom_id ON public.five_d_snapshots(classroom_id);

-- Create a composite index for the most common query pattern (user + classroom)
CREATE INDEX idx_five_d_snapshots_user_classroom ON public.five_d_snapshots(user_id, classroom_id);

-- Add comment explaining the column
COMMENT ON COLUMN public.five_d_snapshots.classroom_id IS 'Links the snapshot to a specific classroom to enable per-classroom progress tracking';

-- Update RLS policies to allow teachers to view snapshots for their classroom students
DROP POLICY IF EXISTS "Teachers can view snapshots of enrolled students" ON public.five_d_snapshots;

CREATE POLICY "Teachers can view snapshots of enrolled students in their classrooms"
  ON public.five_d_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      INNER JOIN public.enrollments e ON e.classroom_id = c.id
      WHERE c.teacher_id = auth.uid()
      AND e.student_id = five_d_snapshots.user_id
      AND (five_d_snapshots.classroom_id IS NULL OR five_d_snapshots.classroom_id = c.id)
    )
  );

