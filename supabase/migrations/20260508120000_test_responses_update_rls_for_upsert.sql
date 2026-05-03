-- Upsert on test_responses needs UPDATE after UNIQUE(submission_id, question_id) conflict.
-- Previously only INSERT/SELECT policies existed, so re-submit failed (duplicate key or RLS).

CREATE POLICY "Students can update their own test responses"
  ON public.test_responses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = test_responses.submission_id
        AND s.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = test_responses.submission_id
        AND s.student_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
