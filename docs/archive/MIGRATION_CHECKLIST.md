# AI Prompts Migration - Implementation Checklist

## Pre-Migration ✅ (Already Done)

- [x] Create database migration for `ai_prompts` table
- [x] Create seed migration with all current prompts
- [x] Create shared utilities for prompt management
- [x] Update all edge functions to use database prompts
- [x] Update frontend to fetch prompts from database
- [x] Remove old hardcoded prompt files
- [x] Create comprehensive documentation

## Your Action Items 🎯

### Step 1: Apply Database Migrations (Required)

```bash
# Navigate to your project directory
cd /path/to/perleap-progress

# Apply migrations to your Supabase instance
supabase db push

# Or if using remote:
supabase db push --linked
```

**Expected Output:**
- Migration `20251110000000_create_ai_prompts_table.sql` applied ✓
- Migration `20251110000001_seed_ai_prompts.sql` applied ✓
- Table `ai_prompts` created with 7 rows

**Verification:**
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) FROM ai_prompts;
-- Should return: 7
```

### Step 2: Regenerate TypeScript Types (Required)

```bash
# Generate updated types including the new ai_prompts table
supabase gen types typescript --local > src/integrations/supabase/types.ts

# Or for remote:
supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

**What this does:**
- Adds TypeScript definitions for `ai_prompts` table
- Allows proper type checking in frontend code

### Step 3: Update Frontend Type Assertion (Required)

After types are regenerated, update `src/components/AssignmentChatInterface.tsx`:

**Change this:**
```typescript
const { data: promptData, error: promptError } = await (supabase as any)
  .from('ai_prompts')
```

**To this:**
```typescript
const { data: promptData, error: promptError } = await supabase
  .from('ai_prompts')
```

### Step 4: Test All Functionality (Critical)

#### Test 1: Student Chat
- [ ] Open a student assignment
- [ ] Verify initial greeting appears
- [ ] Send messages and verify responses
- [ ] Check console for errors

**Expected:** Chat works normally, no errors

#### Test 2: Feedback Generation
- [ ] Complete an assignment as a student
- [ ] Click "Complete Assignment"
- [ ] Verify feedback is generated
- [ ] Check both student and teacher feedback

**Expected:** Feedback generated successfully

#### Test 3: Score Regeneration
- [ ] As a teacher, view a submission
- [ ] Regenerate 5D scores
- [ ] Verify scores update

**Expected:** Scores regenerated successfully

#### Test 4: Wellbeing Analysis
- [ ] Submit assignment with concerning language (test data)
- [ ] Verify alerts are generated if appropriate
- [ ] Check teacher notifications

**Expected:** Wellbeing analysis working

#### Test 5: Database Queries
```sql
-- Verify prompts are being used
SELECT prompt_key, version, is_active 
FROM ai_prompts 
ORDER BY prompt_key;
```

**Expected:** All 7 prompts are active

### Step 5: Monitor Logs (First 24 hours)

Check Supabase logs for:
- [ ] Any "Failed to fetch prompt" errors
- [ ] OpenAI API call successes
- [ ] Performance metrics

**Location:** Supabase Dashboard → Logs → Edge Functions

### Step 6: Backup Original Prompts (Recommended)

```sql
-- Export current prompts as backup
SELECT 
  prompt_key,
  prompt_name,
  prompt_template,
  version
FROM ai_prompts
WHERE is_active = true;
```

Save this output in a safe place.

## Optional Enhancements

### Set Up Monitoring

```sql
-- Create a view for easier prompt management
CREATE OR REPLACE VIEW active_prompts AS
SELECT 
  prompt_key,
  prompt_name,
  version,
  LEFT(prompt_template, 100) as preview,
  updated_at
FROM ai_prompts
WHERE is_active = true;
```

### Create Admin Dashboard Section

Consider adding a UI for managing prompts:
- View all prompts
- Edit prompt templates
- Version history
- A/B testing controls

## Troubleshooting

### Issue: Migration fails

**Solution:**
```bash
# Check migration status
supabase migration list

# Repair if needed
supabase migration repair --status applied <migration_version>
```

### Issue: Type errors persist

**Solution:**
```bash
# Ensure types are regenerated
rm src/integrations/supabase/types.ts
supabase gen types typescript --local > src/integrations/supabase/types.ts

# Restart your dev server
npm run dev
```

### Issue: Prompts not loading

**Solution:**
1. Check RLS policies are active:
```sql
SELECT * FROM pg_policies WHERE tablename = 'ai_prompts';
```

2. Verify prompts exist:
```sql
SELECT COUNT(*) FROM ai_prompts WHERE is_active = true;
```

3. Check edge function logs for errors

### Issue: Chat not working

**Solution:**
1. Check browser console for errors
2. Verify `chat_initial_greeting` prompt exists
3. Test edge function directly:
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/perleap-chat' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "test",
    "assignmentInstructions": "test",
    "submissionId": "test-id",
    "studentId": "test-student",
    "assignmentId": "test-assignment"
  }'
```

## Rollback Plan (If Needed)

### Quick Rollback (Keep Database)

1. Restore old prompt files:
```bash
git restore supabase/functions/perleap-chat/prompts.ts
git restore supabase/functions/generate-feedback/prompts.ts
git restore supabase/functions/analyze-student-wellbeing/prompts.ts
```

2. Revert function imports to use local prompts

3. Deploy changes

### Full Rollback (Remove Database Table)

```sql
-- Only if absolutely necessary
DROP TABLE IF EXISTS ai_prompts CASCADE;
```

Then restore all old files from git history.

## Success Criteria

✅ **Migration is successful when:**

1. [ ] All migrations applied without errors
2. [ ] Types regenerated successfully
3. [ ] Student chat works with initial greeting
4. [ ] Feedback generation produces valid feedback
5. [ ] Score regeneration updates 5D scores
6. [ ] Wellbeing analysis functions correctly
7. [ ] No console errors related to prompts
8. [ ] No edge function errors in logs
9. [ ] Database has 7 active prompts
10. [ ] All tests pass

## Post-Migration Tasks

### Week 1
- [ ] Monitor logs daily
- [ ] Check for any errors
- [ ] Gather feedback from team
- [ ] Document any issues

### Week 2
- [ ] Review prompt performance
- [ ] Consider prompt improvements
- [ ] Plan first prompt update
- [ ] Train team on prompt management

### Month 1
- [ ] Analyze prompt effectiveness
- [ ] Implement A/B testing (if planned)
- [ ] Build admin UI (if planned)
- [ ] Document lessons learned

## Documentation Reference

After migration, refer to these docs:

- **Daily use:** `PROMPT_UPDATE_GUIDE.md`
- **Detailed info:** `PROMPTS_README.md` (in `supabase/functions/_shared/`)
- **Overview:** `PROMPTS_MIGRATION_SUMMARY.md`

## Support Contacts

If you need help:
1. Check the troubleshooting section above
2. Review Supabase dashboard logs
3. Check git history for original code
4. Test in a development environment first

## Final Notes

- 🎉 This migration makes your AI system more flexible and maintainable
- 🔄 Prompts can now be updated without code deployments
- 📊 Version tracking enables better experimentation
- 🛡️ RLS policies keep your prompts secure

---

**Ready to start? Begin with Step 1: Apply Database Migrations** ⬆️

Once all steps are complete, mark this migration as **DONE** and enjoy your new prompt management system! 🚀

