-- Fix notifications INSERT to work with authenticated users specifically
-- Drop the public INSERT policy
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;

-- Create INSERT policies for specific roles
-- Policy 1: For authenticated users (students and teachers)
CREATE POLICY "notifications_insert_authenticated"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 2: For service role (Edge Functions)
CREATE POLICY "notifications_insert_service"
  ON public.notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy 3: For anon role (just in case, though unlikely to be used)
CREATE POLICY "notifications_insert_anon"
  ON public.notifications
  FOR INSERT
  TO anon
  WITH CHECK (true);

