-- Fix notifications SELECT policy to allow teachers (actors) to see what they sent
-- This resolves the 403 Forbidden error when teachers create notifications for students using .select()

-- 1. Drop existing select policy
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;

-- 2. Create updated select policy that includes actor_id
-- This allows users to see notifications sent TO them OR notifications sent BY them.
CREATE POLICY "notifications_select_own_or_sent" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid()) OR 
    actor_id = (select auth.uid())
  );

-- 3. Ensure INSERT policy is still correct (from 20260122000014)
-- This is just to be safe and document what it depends on.
-- notifications_insert_secure handles the insertion permission.

-- 4. Re-grant permissions just in case
GRANT INSERT, SELECT, UPDATE ON public.notifications TO authenticated;
