# Scripts Directory

This directory contains SQL scripts and utilities for database management.

## 📁 Files

### Database Migration & Verification
- `manual_migration.sql` - Manual database migration script
- `verify_5d_migration.sql` - Verification script for 5D scores migration
- `check-migration.sql` - Migration status checker
- `fix_duplicates.sql` - Script to fix duplicate entries
- `populate_user_emails.sql` - Populate email addresses in profile tables
- `verify_user_emails.sql` - Verify all users have email addresses in profiles

## 🎯 Usage

### Running Scripts

**Using Supabase CLI:**
```bash
# Connect to your database
supabase db reset

# Or run specific script
psql -h <host> -U <user> -d <database> -f scripts/manual_migration.sql
```

**Using psql directly:**
```bash
psql -h your-db-host -U postgres -d your-db-name -f scripts/script-name.sql
```

## ⚠️ Important Notes

1. **Always backup** your database before running migration scripts
2. **Test in development** environment first
3. Review script contents before execution
4. Some scripts may require specific execution order

## 📝 Script Descriptions

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `manual_migration.sql` | Complete database schema setup | Initial setup or major migrations |
| `verify_5d_migration.sql` | Check 5D scores migration status | After 5D feature deployment |
| `check-migration.sql` | Verify migration completion | After any migration |
| `fix_duplicates.sql` | Remove duplicate database entries | When duplicate data detected |
| `check_email_column.sql` | **Check if email column exists** | **Before testing email validation** |
| `populate_user_emails.sql` | Add email addresses to existing profiles | After email column migration or to fix missing emails |
| `verify_user_emails.sql` | Check email population status | To verify all users have emails in profiles |

### Email Population Scripts

**⚠️ IMPORTANT: Run the migration FIRST!**

The email validation features require the migration `20251117201353_add_email_to_profiles.sql` to be applied.

**Step 1: Apply the migration**
```bash
# Using Supabase CLI
supabase db push

# OR manually
psql -h your-db-host -U postgres -d your-db-name -f supabase/migrations/20251117201353_add_email_to_profiles.sql
```

**Step 2: Check if email column exists**
```bash
psql -h your-db-host -U postgres -d your-db-name -f scripts/check_email_column.sql
```

**Step 3: Verify email population**
```bash
psql -h your-db-host -U postgres -d your-db-name -f scripts/verify_user_emails.sql
```

**Step 4: If emails are missing, run the populate script**
```bash
psql -h your-db-host -U postgres -d your-db-name -f scripts/populate_user_emails.sql
```

**Expected Results:**
- All teacher profiles should have `email` field populated from `auth.users`
- All student profiles should have `email` field populated from `auth.users`
- Email validation will prevent duplicate registrations

**If the column doesn't exist:**
- The email validation won't work
- Users can register with duplicate emails
- You'll see errors in the browser console about missing column

---

*Last updated: November 2025*

