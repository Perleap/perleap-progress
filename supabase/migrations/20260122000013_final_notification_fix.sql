-- Comprehensive fix for notifications RLS and permissions
-- This ensures teachers can notify students when assignments are created/updated

-- 1. Ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop all known previous versions of insert policies to avoid conflicts or restrictive overlaps
DROP POLICY IF EXISTS "notifications_insert_system" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.notifications;
DROP POLICY IF EXISTS "Allow service role insert" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications for anyone" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- 3. Create a single, clean, permissive INSERT policy
-- We use a broad name to avoid future conflicts
CREATE POLICY "notifications_insert_all_authenticated" ON public.notifications
  FOR INSERT 
  TO authenticated, service_role
  WITH CHECK (true);

-- 4. Explicitly grant permissions to roles (sometimes needed if defaults were changed)
GRANT INSERT, SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 5. Verify select policy allows teachers to see what they created (optional but helpful)
-- Currently notifications_select_own only allows users to see notifications sent TO them.
-- If teachers need to see notifications they SENT, we'd need another policy.
-- But for now, the 403 is on INSERT.
