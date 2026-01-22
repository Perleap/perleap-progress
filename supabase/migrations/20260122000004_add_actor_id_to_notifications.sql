-- Add actor_id to notifications table to track who triggered the notification
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications(actor_id);

-- Update existing notifications by extracting student_id from metadata if possible
-- This is a one-time backfill, only for existing users
UPDATE public.notifications
SET actor_id = (metadata->>'student_id')::uuid
WHERE actor_id IS NULL 
AND metadata->>'student_id' IS NOT NULL
AND metadata->>'student_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
AND EXISTS (SELECT 1 FROM auth.users WHERE id = (metadata->>'student_id')::uuid);

-- Also check for teacher_id in metadata (if any exist)
UPDATE public.notifications
SET actor_id = (metadata->>'teacher_id')::uuid
WHERE actor_id IS NULL 
AND metadata->>'teacher_id' IS NOT NULL
AND metadata->>'teacher_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
AND EXISTS (SELECT 1 FROM auth.users WHERE id = (metadata->>'teacher_id')::uuid);

