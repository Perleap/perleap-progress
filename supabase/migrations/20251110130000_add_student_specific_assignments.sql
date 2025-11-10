-- Add assigned_student_id to assignments table for student-specific assignments
-- When NULL, assignment is visible to all students in the classroom
-- When set, assignment is only visible to that specific student

ALTER TABLE public.assignments 
ADD COLUMN assigned_student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX idx_assignments_assigned_student ON public.assignments(assigned_student_id);

-- Drop existing RLS policy for students viewing assignments
DROP POLICY IF EXISTS "Students can view published assignments in enrolled classrooms" ON public.assignments;

-- Recreate policy with student-specific logic
CREATE POLICY "Students can view published assignments in enrolled classrooms"
  ON public.assignments FOR SELECT
  USING (
    status = 'published' AND
    EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE enrollments.classroom_id = assignments.classroom_id
      AND enrollments.student_id = auth.uid()
    )
    AND (assigned_student_id IS NULL OR assigned_student_id = auth.uid())
  );

-- Comment for documentation
COMMENT ON COLUMN public.assignments.assigned_student_id IS 'When NULL, assignment is classroom-wide. When set, assignment is only visible to and required for this specific student.';

