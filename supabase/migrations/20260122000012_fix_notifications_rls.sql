-- Fix RLS policy for notifications to allow authenticated users to create notifications
-- This is required for teachers to notify students when assignments are created/updated

DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;

-- Allow both service role and authenticated users to insert notifications
CREATE POLICY "notifications_insert_policy" ON public.notifications
  FOR INSERT TO authenticated, service_role
  WITH CHECK (true);

-- Ensure RLS is still enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
