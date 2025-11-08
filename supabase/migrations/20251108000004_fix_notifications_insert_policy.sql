-- Fix notifications INSERT policy to allow authenticated users to create notifications for anyone
-- This is needed because teachers create notifications for students and vice versa

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can create notifications" ON public.notifications;

-- Create a single permissive INSERT policy for authenticated users
-- This allows any authenticated user to create a notification for any user
CREATE POLICY "Allow authenticated insert"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure service role can also insert (for Edge Functions)
CREATE POLICY "Allow service role insert"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

