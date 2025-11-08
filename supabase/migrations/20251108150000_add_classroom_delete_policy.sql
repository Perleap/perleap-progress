-- Add DELETE policy for classrooms so teachers can delete their own classrooms
CREATE POLICY "Teachers can delete their own classrooms"
ON public.classrooms
FOR DELETE
USING (auth.uid() = teacher_id);

