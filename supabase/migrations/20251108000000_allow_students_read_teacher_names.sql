-- Allow students to read teacher profiles (specifically names) for teachers of classrooms they're enrolled in
CREATE POLICY "Students can view their teachers' profiles"
ON public.teacher_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.classrooms c
    INNER JOIN public.enrollments e ON e.classroom_id = c.id
    WHERE c.teacher_id = teacher_profiles.user_id
    AND e.student_id = auth.uid()
  )
);

