# 🚨 Dual Profile Bug - Quick Fix Reference Card

## Emergency: User Stuck in "Redirecting..." Loop

### Immediate Fix (3 Steps - 2 Minutes)

#### Step 1: Run SQL Script
```sql
-- In Supabase SQL Editor, run:
\i scripts/fix_stuck_user.sql

-- Replace 'STUCK_USER_EMAIL_HERE' with actual email
-- Example: 'john.doe@school.edu'
```

#### Step 2: Note Which Profile Was Kept
Script will output something like:
```
→ Keeping TEACHER profile (older), deleting STUDENT profile
```

#### Step 3: Update User Metadata
1. Supabase Dashboard → Authentication → Users
2. Find user by email
3. Edit "Raw User Metadata"
4. Set: `{"role": "teacher"}` or `{"role": "student"}` to match Step 2

✅ **Done!** User can now log in.

---

## Quick Diagnostics

### Check if Protection System is Active
```sql
\i scripts/verify_dual_profile_prevention.sql
```
All checks should say "✓ PASS"

### List All Users with Dual Profiles
```sql
SELECT * FROM public.admin_list_dual_profiles();
```
Should return 0 rows (after fixes)

### Check Specific User's Status
```sql
SELECT * FROM public.admin_get_user_profile_status('user@example.com');
```

---

## Common Issues & Solutions

### Issue: "Trigger not found"
**Solution:** Run the migration
```sql
\i supabase/migrations/20251117193347_prevent_duplicate_profiles.sql
```

### Issue: User still stuck after fix
**Solution:** Verify you updated the metadata to match the kept profile

### Issue: Multiple users affected
**Solution:** Use the admin function
```sql
-- For each affected user:
SELECT * FROM public.admin_fix_dual_profile('user-uuid-here', 'older');
```

---

## File Locations

| Purpose | File Path |
|---------|-----------|
| Emergency Fix | `scripts/fix_stuck_user.sql` |
| Verification | `scripts/verify_dual_profile_prevention.sql` |
| Admin Functions | `scripts/admin_dual_profile_utility.sql` |
| Complete Guide | `DUAL_PROFILE_BUG_FIX_GUIDE.md` |
| Implementation Details | `IMPLEMENTATION_SUMMARY.md` |

---

## Support Commands

```sql
-- Get user UUID from email
SELECT id FROM auth.users WHERE email = 'user@example.com';

-- Check user's profiles
SELECT 'teacher' as type, created_at FROM teacher_profiles WHERE user_id = 'UUID'
UNION ALL
SELECT 'student' as type, created_at FROM student_profiles WHERE user_id = 'UUID';

-- Check user metadata
SELECT raw_user_meta_data FROM auth.users WHERE email = 'user@example.com';
```

---

## Prevention Status Checklist

- [ ] Database trigger active (run verify script)
- [ ] Frontend changes deployed
- [ ] Translation keys added
- [ ] No existing dual profiles (run list function)
- [ ] Error messages display correctly
- [ ] Users redirect properly

---

**Need More Details?** See `DUAL_PROFILE_BUG_FIX_GUIDE.md`

