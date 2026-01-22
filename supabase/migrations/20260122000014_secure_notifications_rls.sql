-- Secure fix for notifications RLS
-- Addresses Supabase Linter warning about "Always True" policies
-- and resolves the 403 Forbidden error for teachers sending notifications.

-- 1. Ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop the overly permissive or conflicting policies
DROP POLICY IF EXISTS "notifications_insert_all_authenticated" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;

-- 3. Create a secure INSERT policy
-- This policy allows authenticated users to insert notifications ONLY IF
-- they are the actor (sender). This prevents impersonation.
CREATE POLICY "notifications_insert_secure" ON public.notifications
  FOR INSERT 
  TO authenticated
  WITH CHECK (actor_id = (select auth.uid()));

-- 4. Keep service role policy for Edge Functions (system-generated)
CREATE POLICY "notifications_insert_service" ON public.notifications
  FOR INSERT 
  TO service_role
  WITH CHECK (true);

-- 5. Explicitly grant permissions
GRANT INSERT, SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
