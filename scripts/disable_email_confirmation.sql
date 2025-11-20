-- Temporary: Disable email confirmation for testing
-- Run this in Supabase SQL Editor

-- This will automatically confirm all new signups
-- WARNING: Only use this in development or if you trust your users!

-- Check current auth config
SELECT 
  'Current Settings' as check_type,
  enable_signup,
  enable_email_confirmations,
  enable_email_autoconfirm
FROM auth.config;

-- To disable email confirmations (users are auto-confirmed):
-- You need to do this in the Supabase Dashboard:
-- Authentication → Settings → Email Auth
-- Toggle OFF "Enable email confirmations"

-- Or if you're using local Supabase, update config.toml:
-- [auth]
-- enable_signup = true
-- enable_confirmations = false

