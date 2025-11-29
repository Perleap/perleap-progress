# Registration and Language Issue Debugging Guide

## Problem Description
Users registering in Hebrew are experiencing a 406 error when trying to access their profile/settings. The profile may not be saved with the correct language preference.

## Root Causes Identified

### 1. **Profile Not Created During Onboarding**
If profile creation fails silently during onboarding, the user gets redirected to dashboard but has no profile in the database.

### 2. **Language Not Saved Correctly**
The `preferred_language` field might be NULL or incorrect when the profile is created.

### 3. **406 Error on Query**
The 406 (Not Acceptable) error occurs when:
- Trying to query a non-existent profile
- RLS policies blocking access
- Schema mismatch between frontend and database

## Diagnostic Steps

### Step 1: Check if Profiles Are Being Created

Run `check_profile_status.sql` in your Supabase SQL Editor:

```sql
-- This will show recent profiles and their language settings
SELECT 
    sp.email,
    sp.full_name,
    sp.preferred_language,
    sp.created_at
FROM student_profiles sp
ORDER BY sp.created_at DESC
LIMIT 10;
```

**Expected:** You should see profiles with `preferred_language` set to either 'en' or 'he'
**If you see:** NULL values or missing profiles, continue to Step 2

### Step 2: Check for Orphaned Auth Users

Users who registered but don't have profiles:

```sql
SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'role' as intended_role,
    CASE 
        WHEN EXISTS (SELECT 1 FROM student_profiles WHERE user_id = au.id) THEN 'HAS PROFILE'
        ELSE 'NO PROFILE'
    END as status
FROM auth.users au
ORDER BY au.created_at DESC
LIMIT 10;
```

**If you see "NO PROFILE":** The registration completed but onboarding failed

### Step 3: Test Registration Flow

1. Open your browser console (F12)
2. Register a new test account in Hebrew
3. Watch the console for these logs:
   - "Creating student profile with language: he"
   - "Profile data to insert: ..." (should show preferred_language: 'he')
   - "Profile created successfully: ..."

**If you see an error:** Note the error code and message

## Common Error Codes

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `23505` | Duplicate key - profile already exists | Delete old profile or use different email |
| `42703` | Column doesn't exist in database | Run missing migrations |
| `23502` | NOT NULL constraint violation | Required field is missing |
| `406` | Not Acceptable - query failed | Check RLS policies |

## Fixes Applied

### 1. Enhanced Error Logging
Both `StudentOnboarding.tsx` and `TeacherOnboarding.tsx` now have:
- Console logs showing the language being used
- Console logs showing the full profile data
- Better error handling with specific error codes
- Fallback to 'en' if language is undefined

### 2. Language Fallback
```typescript
preferred_language: language || 'en'
```
This ensures even if `language` is undefined, we save 'en' instead of NULL.

## How to Test the Fix

1. **Clear any existing test data:**
   ```sql
   -- In Supabase SQL Editor
   DELETE FROM student_profiles WHERE email = 'test@example.com';
   DELETE FROM auth.users WHERE email = 'test@example.com';
   ```

2. **Register in Hebrew:**
   - Change language to Hebrew (עברית) in the app
   - Register with a new email
   - Complete onboarding
   - Check console for logs

3. **Verify in Database:**
   ```sql
   SELECT email, preferred_language FROM student_profiles 
   WHERE email = 'test@example.com';
   ```
   Expected: `preferred_language` should be 'he'

4. **Log out and log back in:**
   - The app should load in Hebrew
   - No 406 errors should appear

## If Issues Persist

### Check RLS Policies
```sql
-- Verify RLS policies allow the user to read their own profile
SELECT * FROM student_profiles WHERE user_id = 'YOUR-USER-ID';
```

### Check Profile Schema
```sql
-- Verify all columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'student_profiles'
AND column_name IN ('preferred_language', 'email', 'full_name');
```

### Manual Fix for Existing Users
If you have users stuck with NULL language:
```sql
-- Run fix_profile_language.sql
UPDATE student_profiles 
SET preferred_language = 'en' 
WHERE preferred_language IS NULL;
```

## Prevention

The code now includes:
1. ✅ Proper error logging
2. ✅ Fallback values for language
3. ✅ Better error messages to users
4. ✅ Console logs for debugging
5. ✅ Validation of inserted data

## Next Steps

1. Run `check_profile_status.sql` to see current state
2. Test registration with a new Hebrew user
3. Monitor console logs during registration
4. If any profiles have NULL language, run `fix_profile_language.sql`
5. Report back with console logs if issues continue

