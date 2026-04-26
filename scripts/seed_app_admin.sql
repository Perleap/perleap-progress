-- Grant app admin to a user (run in Supabase SQL Editor after migration 20260427100000_admin_role_full_stack.sql).
--
-- 1) Replace the UUID below with the real auth.users id.
-- 2) Run this INSERT.
-- 3) Set JWT user_metadata.role to "admin" so the SPA routes correctly:
--    - Supabase Dashboard → Authentication → Users → user → Edit → User metadata: { "role": "admin" }
--    - Or use the Auth Admin API / service role: auth.admin.updateUserById(id, { user_metadata: { role: 'admin' } })
--
-- The app can also self-sync: on login, AuthCallback reads app_admins and calls updateUserRole('admin')
-- if a row exists (client can only set admin metadata when app_admins contains the user).

INSERT INTO public.app_admins (user_id)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (user_id) DO NOTHING;
