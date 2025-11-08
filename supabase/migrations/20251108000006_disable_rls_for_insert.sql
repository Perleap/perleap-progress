-- Nuclear option: Remove all INSERT policies and create a single permissive one
-- Drop all existing policies completely
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.notifications;
DROP POLICY IF EXISTS "Allow service role insert" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications for anyone" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can create notifications" ON public.notifications;

-- Create a single, maximally permissive INSERT policy
CREATE POLICY "notifications_insert_policy"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- This policy applies to ALL roles (anon, authenticated, service_role)
-- and allows inserting any notification for any user

