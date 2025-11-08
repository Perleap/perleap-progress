-- Final fix for notifications RLS - allow inserting notifications for any user
-- The issue is that WITH CHECK (true) alone isn't sufficient

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.notifications;
DROP POLICY IF EXISTS "Allow service role insert" ON public.notifications;

-- Create a permissive INSERT policy that explicitly allows inserting for any user_id
-- This is needed because teachers create notifications for students and vice versa
CREATE POLICY "Users can insert notifications for anyone"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow authenticated users to create notifications for any user
    -- The auth.uid() checks that the user is logged in (handled by TO authenticated)
    -- but we don't restrict which user_id they can insert
    true
  );

-- Keep service role policy for Edge Functions
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant necessary permissions
GRANT INSERT ON public.notifications TO authenticated;
GRANT INSERT ON public.notifications TO service_role;

