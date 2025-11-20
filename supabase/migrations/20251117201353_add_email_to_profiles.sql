-- Migration: Add email to profile tables for duplicate detection
-- This allows us to check for duplicate registrations by email address

-- Step 1: Add email column to teacher_profiles
ALTER TABLE public.teacher_profiles 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 2: Add email column to student_profiles
ALTER TABLE public.student_profiles 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Step 3: Update existing teacher records with email from auth.users
UPDATE public.teacher_profiles tp
SET email = au.email
FROM auth.users au
WHERE tp.user_id = au.id
  AND tp.email IS NULL;

-- Step 4: Update existing student records with email from auth.users
UPDATE public.student_profiles sp
SET email = au.email
FROM auth.users au
WHERE sp.user_id = au.id
  AND sp.email IS NULL;

-- Step 5: Make email NOT NULL after populating existing records
ALTER TABLE public.teacher_profiles 
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE public.student_profiles 
  ALTER COLUMN email SET NOT NULL;

-- Step 6: Create unique index on email for both tables (to prevent duplicate emails)
-- Note: These are created AFTER populating data to avoid conflicts
CREATE UNIQUE INDEX IF NOT EXISTS teacher_profiles_email_key ON public.teacher_profiles(email);
CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_email_key ON public.student_profiles(email);

-- Step 7: Add comments for documentation
COMMENT ON COLUMN public.teacher_profiles.email IS 
  'Email address of the teacher - used for duplicate detection and validation';

COMMENT ON COLUMN public.student_profiles.email IS 
  'Email address of the student - used for duplicate detection and validation';

