-- Re-enable RLS and set up correct policies for notifications table
-- First, ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.notifications;
DROP POLICY IF EXISTS "Allow service role insert" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications for anyone" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can create notifications" ON public.notifications;

-- Create SELECT policy - users can view their own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  TO public
  USING (auth.uid() = user_id);

-- Create UPDATE policy - users can update their own notifications
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  TO public
  USING (auth.uid() = user_id);

-- Create INSERT policy - ANY authenticated user can insert notifications for ANY user
-- This is key: we use TO public (which includes authenticated) and WITH CHECK (true)
CREATE POLICY "notifications_insert_all"
  ON public.notifications
  FOR INSERT
  TO public
  WITH CHECK (true);

