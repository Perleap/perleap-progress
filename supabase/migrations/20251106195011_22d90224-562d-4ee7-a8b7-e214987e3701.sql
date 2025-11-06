-- Allow anyone to find classrooms by invite code (needed for join flow)
CREATE POLICY "Anyone can find classrooms by invite code"
ON public.classrooms
FOR SELECT
USING (invite_code IS NOT NULL);