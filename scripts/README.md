# Database Scripts - Dual Profile Bug Fix

This directory contains SQL scripts for managing and fixing the dual profile bug.

## 📁 Scripts Overview

### 🚨 Emergency Scripts

#### `fix_stuck_user.sql`
**Purpose**: Quickly fix a specific user stuck in the redirecting loop

**Usage**:
1. Replace `'STUCK_USER_EMAIL_HERE'` with the actual user email
2. Run in Supabase SQL Editor
3. Follow the output instructions to update user metadata

**When to Use**: When you have a user who cannot log in due to dual profiles

---

### 🔍 Diagnostic Scripts

#### `verify_dual_profile_prevention.sql`
**Purpose**: Verify that all prevention mechanisms are active

**Usage**: Run in Supabase SQL Editor - no modifications needed

**What It Checks**:
- ✅ Prevention function exists
- ✅ Triggers are active on both tables
- ✅ No existing dual profiles
- ✅ UNIQUE constraints in place

**When to Use**: 
- After deployment to verify setup
- Monthly health checks
- After database maintenance

---

#### `cleanup_dual_profiles.sql`
**Purpose**: Comprehensive diagnosis and cleanup tool

**Usage**: 
1. Run Part 1 to identify all dual profile users
2. Run Part 2 with specific email to fix a user
3. Run Part 4 to verify triggers
4. Run Part 5 to test trigger functionality

**What It Includes**:
- Query to list all dual profiles
- Cleanup logic with explanation
- Trigger verification
- Manual cleanup queries

**When to Use**: 
- When multiple users are affected
- For bulk cleanup operations
- For detailed diagnostics

---

### 🛠️ Admin Utility Functions

#### `admin_dual_profile_utility.sql`
**Purpose**: Create reusable database functions for ongoing management

**Usage**: 
1. Run once to create the functions
2. Use the functions via SQL commands

**Functions Created**:

##### `admin_list_dual_profiles()`
Lists all users with both profile types
```sql
SELECT * FROM public.admin_list_dual_profiles();
```

##### `admin_get_user_profile_status(email_or_uuid)`
Get detailed status of a specific user
```sql
SELECT * FROM public.admin_get_user_profile_status('user@example.com');
```

##### `admin_fix_dual_profile(user_id, keep_type)`
Fix a user's dual profile
```sql
-- Keep the older profile
SELECT * FROM public.admin_fix_dual_profile('uuid-here', 'older');

-- Keep teacher profile
SELECT * FROM public.admin_fix_dual_profile('uuid-here', 'teacher');

-- Keep student profile
SELECT * FROM public.admin_fix_dual_profile('uuid-here', 'student');
```

**When to Use**: For ongoing management and automation

---

## 🎯 Quick Reference

### Fix Stuck User (3 Steps)

```sql
-- 1. Run fix_stuck_user.sql with user's email

-- 2. Check what was kept
SELECT * FROM public.admin_get_user_profile_status('user@example.com');

-- 3. Update user metadata in Supabase Dashboard to match kept profile
```

### Check System Health

```sql
-- Run verification script
\i scripts/verify_dual_profile_prevention.sql

-- List any problematic users
SELECT * FROM public.admin_list_dual_profiles();
```

### Bulk Cleanup

```sql
-- List all issues
SELECT * FROM public.admin_list_dual_profiles();

-- Fix each one
SELECT * FROM public.admin_fix_dual_profile('user-uuid-1', 'older');
SELECT * FROM public.admin_fix_dual_profile('user-uuid-2', 'older');
-- etc...
```

---

## 📋 Script Execution Order (First Time Setup)

1. **Verify Prevention System**
   ```sql
   \i scripts/verify_dual_profile_prevention.sql
   ```

2. **Create Admin Functions**
   ```sql
   \i scripts/admin_dual_profile_utility.sql
   ```

3. **Check for Existing Issues**
   ```sql
   SELECT * FROM public.admin_list_dual_profiles();
   ```

4. **Fix Any Issues Found**
   ```sql
   \i scripts/fix_stuck_user.sql
   -- OR --
   SELECT * FROM public.admin_fix_dual_profile('user-uuid', 'older');
   ```

---

## ⚠️ Important Notes

### After Running Fix Scripts

**Always update user metadata!** The scripts can only delete profiles, they cannot update auth.users metadata. You must:

1. Go to Supabase Dashboard → Authentication → Users
2. Find the user
3. Edit Raw User Metadata
4. Set `{"role": "teacher"}` or `{"role": "student"}` to match the kept profile

### Safety

- All scripts use `SECURITY DEFINER` to ensure they run with proper permissions
- Scripts are idempotent - safe to run multiple times
- All operations are logged with `RAISE NOTICE` statements
- No script will delete ALL profiles - at least one is always kept

### Troubleshooting

**Q: Script says "User not found"**  
A: Check the email/UUID is correct. Use the exact email from auth.users.

**Q: Trigger not detected**  
A: Run the migration `20251117193347_prevent_duplicate_profiles.sql` in production.

**Q: User still stuck after fix**  
A: Verify you updated the user metadata to match the kept profile.

---

## 📞 Support Commands

```sql
-- Get user UUID from email
SELECT id, email, raw_user_meta_data->>'role' as role 
FROM auth.users 
WHERE email = 'user@example.com';

-- Check user's profiles manually
SELECT 'teacher' as type, full_name, created_at 
FROM teacher_profiles 
WHERE user_id = 'user-uuid'
UNION ALL
SELECT 'student' as type, full_name, created_at 
FROM student_profiles 
WHERE user_id = 'user-uuid';

-- Check trigger status
SELECT trigger_name, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_name LIKE '%prevent_duplicate_profile%';
```

---

**Last Updated**: December 11, 2024
