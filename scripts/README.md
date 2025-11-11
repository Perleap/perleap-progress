# Scripts Directory

This directory contains SQL scripts and utilities for database management.

## 📁 Files

### Database Migration & Verification
- `manual_migration.sql` - Manual database migration script
- `verify_5d_migration.sql` - Verification script for 5D scores migration
- `check-migration.sql` - Migration status checker
- `fix_duplicates.sql` - Script to fix duplicate entries

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

---

*Last updated: November 2025*

