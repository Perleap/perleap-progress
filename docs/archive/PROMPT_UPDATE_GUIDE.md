# Quick Guide: How to Update AI Prompts

## Access the Prompts

### Via Supabase Dashboard

1. Go to Supabase Dashboard → SQL Editor
2. Run: `SELECT * FROM ai_prompts;`
3. View all prompts with their keys and templates

### Via SQL Query

```sql
-- View all prompts
SELECT prompt_key, prompt_name, version, is_active 
FROM ai_prompts 
ORDER BY prompt_key;

-- View a specific prompt
SELECT * FROM ai_prompts 
WHERE prompt_key = 'chat_system';
```

## Update a Prompt

### Option 1: Simple Update (Recommended)

```sql
UPDATE ai_prompts
SET 
  prompt_template = 'Your new prompt text with {{variables}}',
  version = version + 1
WHERE prompt_key = 'chat_system';
```

### Option 2: Test New Version First

```sql
-- Duplicate existing prompt with new version
INSERT INTO ai_prompts (
  prompt_key,
  prompt_name,
  prompt_template,
  description,
  variables,
  is_active,
  version
)
SELECT 
  prompt_key,
  prompt_name,
  'Your new prompt text',
  description,
  variables,
  false,  -- Start as inactive
  version + 1
FROM ai_prompts
WHERE prompt_key = 'chat_system' AND is_active = true;

-- When ready to activate:
-- 1. Deactivate old version
UPDATE ai_prompts SET is_active = false 
WHERE prompt_key = 'chat_system' AND version = 1;

-- 2. Activate new version
UPDATE ai_prompts SET is_active = true 
WHERE prompt_key = 'chat_system' AND version = 2;
```

## Common Prompts to Update

### 1. Chat System Prompt (`chat_system`)

**When to update:** Change how the AI assistant behaves with students

```sql
UPDATE ai_prompts
SET prompt_template = '
You are a warm, encouraging educational assistant helping a student complete their assignment.

Your approach:
- [YOUR NEW GUIDELINES HERE]

**Assignment Instructions:**
{{assignmentInstructions}}

{{greetingInstruction}}

{{afterGreeting}}
'
WHERE prompt_key = 'chat_system';
```

### 2. Initial Greeting (`chat_initial_greeting`)

**When to update:** Change what triggers the initial AI greeting

```sql
UPDATE ai_prompts
SET prompt_template = '[System: Your new initial message instruction]'
WHERE prompt_key = 'chat_initial_greeting';
```

### 3. Feedback Generation (`feedback_generation`)

**When to update:** Modify feedback style, length, or content

```sql
UPDATE ai_prompts
SET prompt_template = '
# You are Agent "Perleap"...

**1. Feedback for {{studentName}} (the student):**
- [YOUR NEW STUDENT FEEDBACK GUIDELINES]

**2. Feedback for {{teacherName}} (the teacher):**
- [YOUR NEW TEACHER FEEDBACK GUIDELINES]

[Rest of prompt...]
'
WHERE prompt_key = 'feedback_generation';
```

### 4. 5D Scores (`five_d_scores`)

**When to update:** Adjust scoring criteria or dimensions

```sql
UPDATE ai_prompts
SET prompt_template = '
You are analyzing a student''s learning conversation...

Analyze {{studentName}}''s conversation and rate them on a scale of 0-10:

**Cognitive:** [Your criteria]
**Emotional:** [Your criteria]
[etc...]
'
WHERE prompt_key = 'five_d_scores';
```

### 5. Wellbeing Analysis (`wellbeing_analysis`)

**When to update:** Adjust sensitivity or alert criteria

```sql
UPDATE ai_prompts
SET prompt_template = '
You are a trained educational psychologist...

**ALERT LEVELS:**
[Your updated alert criteria]
'
WHERE prompt_key = 'wellbeing_analysis';
```

## Variable Syntax

Use `{{variableName}}` for placeholders:

```
Hello {{studentName}}, welcome to {{courseName}}!
```

## Important Notes

### ⚠️ Don't Break Variables

Make sure you don't remove required variables. Check which variables are needed:

```sql
SELECT prompt_key, variables 
FROM ai_prompts 
WHERE prompt_key = 'chat_system';
```

### ⚠️ Test Your Changes

After updating a prompt:
1. Test the affected functionality immediately
2. Check logs for errors
3. Verify AI responses are as expected

### ⚠️ Escaping Single Quotes

In SQL strings, escape single quotes by doubling them:

```sql
-- Wrong:
'Don't do this'

-- Right:
'Don''t do this'
```

## Rollback a Prompt

```sql
-- Find previous version
SELECT version, prompt_template, updated_at 
FROM ai_prompts 
WHERE prompt_key = 'chat_system' 
ORDER BY version DESC;

-- Restore old version (copy the old template)
UPDATE ai_prompts
SET 
  prompt_template = '[paste old template here]',
  version = version + 1
WHERE prompt_key = 'chat_system' AND is_active = true;
```

## Add a New Prompt

```sql
INSERT INTO ai_prompts (
  prompt_key,
  prompt_name,
  prompt_template,
  description,
  variables
) VALUES (
  'my_new_prompt',
  'My New Prompt',
  'Template with {{variable1}}',
  'What this prompt does',
  '["variable1"]'::jsonb
);
```

Then use it in code:

```typescript
import { getPrompt } from '../_shared/prompts.ts';

const prompt = await getPrompt('my_new_prompt', {
  variable1: 'value'
});
```

## Quick Reference: Prompt Keys

| Key | Purpose | Variables |
|-----|---------|-----------|
| `chat_system` | Main chat behavior | `assignmentInstructions`, `greetingInstruction`, `afterGreeting` |
| `chat_initial_greeting` | Trigger greeting | None |
| `chat_greeting_instruction` | Greeting template | `teacherName` |
| `chat_after_greeting` | Post-greeting | None |
| `feedback_generation` | Feedback | `studentName`, `teacherName` |
| `five_d_scores` | Scoring | `studentName` |
| `wellbeing_analysis` | Wellbeing check | `studentName` |

## Monitoring Changes

```sql
-- See recent updates
SELECT prompt_key, version, updated_at, is_active
FROM ai_prompts
ORDER BY updated_at DESC
LIMIT 10;

-- Check active versions
SELECT prompt_key, version, 
  LEFT(prompt_template, 50) as preview
FROM ai_prompts
WHERE is_active = true;
```

## Best Practices

1. ✅ **Always increment version** when making changes
2. ✅ **Test in development first** before updating production
3. ✅ **Keep old versions** (set `is_active = false` instead of deleting)
4. ✅ **Document why** you made changes (in commit messages or comments)
5. ✅ **Check logs after** updating to catch errors
6. ✅ **Be cautious with wellbeing prompts** - they trigger important alerts

## Emergency: Disable a Prompt

```sql
-- Temporarily disable a prompt
UPDATE ai_prompts
SET is_active = false
WHERE prompt_key = 'problematic_prompt';
```

The system will log errors but should have fallbacks.

## Need Help?

1. Check `PROMPTS_README.md` for detailed documentation
2. View `PROMPTS_MIGRATION_SUMMARY.md` for system overview
3. Check Supabase logs for error messages
4. Review the prompt template for syntax errors

---

**Pro Tip:** Keep a backup of your prompts before making major changes!

```sql
-- Export all prompts
COPY (SELECT * FROM ai_prompts WHERE is_active = true) 
TO '/tmp/prompts_backup.csv' CSV HEADER;
```

