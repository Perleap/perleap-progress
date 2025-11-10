# AI Prompts Management System

## Overview

The Perleap application now uses a database-driven approach for managing AI prompts. All prompts are stored in the `ai_prompts` table in Supabase, allowing for dynamic updates without code changes.

## Database Schema

### Table: `ai_prompts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `prompt_key` | TEXT | Unique identifier for the prompt (e.g., 'chat_system') |
| `prompt_name` | TEXT | Human-readable name |
| `prompt_template` | TEXT | The actual prompt with `{{variable}}` placeholders |
| `description` | TEXT | Description of the prompt's purpose |
| `variables` | JSONB | Array of variable names expected in the template |
| `is_active` | BOOLEAN | Whether this prompt is currently active |
| `version` | INTEGER | Version number for tracking changes |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

## Current Prompts

### 1. `chat_system`
- **Purpose**: Main system prompt for the Perleap chat agent
- **Variables**: `assignmentInstructions`, `greetingInstruction`, `afterGreeting`
- **Used by**: `perleap-chat` function

### 2. `chat_initial_greeting`
- **Purpose**: Initial message to trigger AI greeting
- **Variables**: None
- **Used by**: Frontend `AssignmentChatInterface` component

### 3. `chat_greeting_instruction`
- **Purpose**: Dynamic instruction for initial greeting
- **Variables**: `teacherName`
- **Used by**: `perleap-chat` function (when `isInitialGreeting=true`)

### 4. `chat_after_greeting`
- **Purpose**: Instruction for after the initial greeting
- **Variables**: None
- **Used by**: `perleap-chat` function (when `isInitialGreeting=true`)

### 5. `feedback_generation`
- **Purpose**: Generate student and teacher feedback
- **Variables**: `studentName`, `teacherName`
- **Used by**: `generate-feedback` function

### 6. `five_d_scores`
- **Purpose**: Generate 5D dimension scores
- **Variables**: `studentName`
- **Used by**: `generate-feedback` and `regenerate-scores` functions

### 7. `wellbeing_analysis`
- **Purpose**: Analyze student wellbeing and detect concerning signs
- **Variables**: `studentName`
- **Used by**: `analyze-student-wellbeing` function

## How to Update Prompts

### Via SQL (Supabase Dashboard)

```sql
-- Update a prompt template
UPDATE ai_prompts
SET 
  prompt_template = 'Your new prompt template with {{variables}}',
  version = version + 1
WHERE prompt_key = 'chat_system';

-- Deactivate a prompt
UPDATE ai_prompts
SET is_active = false
WHERE prompt_key = 'old_prompt_key';

-- Add a new prompt
INSERT INTO ai_prompts (
  prompt_key,
  prompt_name,
  prompt_template,
  description,
  variables
) VALUES (
  'new_prompt',
  'New Prompt Name',
  'Template with {{variable1}} and {{variable2}}',
  'Description of what this prompt does',
  '["variable1", "variable2"]'::jsonb
);
```

### Via API (TypeScript)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, serviceKey);

// Update a prompt
await supabase
  .from('ai_prompts')
  .update({
    prompt_template: 'New template',
    version: incrementVersion,
  })
  .eq('prompt_key', 'chat_system');
```

## Utility Functions

The `_shared/prompts.ts` module provides helper functions:

### `getPromptTemplate(promptKey: string): Promise<string>`
Fetches a raw prompt template from the database.

### `renderPrompt(template: string, variables: Record<string, string>): string`
Replaces `{{variableName}}` placeholders with actual values.

### `getPrompt(promptKey: string, variables?: Record<string, string>): Promise<string>`
Fetches and renders a prompt in one call.

### Specialized Functions

- `generateChatSystemPrompt(assignmentInstructions, teacherName, isInitialGreeting)`
- `generateFeedbackPrompt(studentName, teacherName)`
- `generateScoresPrompt(studentName)`
- `generateWellbeingAnalysisPrompt(studentName)`
- `getInitialGreetingMessage()`

## Usage Examples

### In Edge Functions

```typescript
import { generateChatSystemPrompt } from '../_shared/prompts.ts';

const systemPrompt = await generateChatSystemPrompt(
  assignmentInstructions,
  teacherName,
  isInitialGreeting
);
```

### In Frontend

```typescript
// Fetch a prompt directly
const { data } = await supabase
  .from('ai_prompts')
  .select('prompt_template')
  .eq('prompt_key', 'chat_initial_greeting')
  .eq('is_active', true)
  .single();

const message = data?.prompt_template;
```

## Best Practices

1. **Version Control**: Always increment the `version` field when updating prompts
2. **Testing**: Test prompt changes in a development environment first
3. **Backup**: Keep backups of working prompts before making changes
4. **Variables**: Ensure all variables referenced in templates are provided
5. **Activation**: Use `is_active` flag to safely test new prompts alongside old ones
6. **Documentation**: Update this README when adding new prompts

## Rollback Strategy

To rollback to a previous prompt version:

1. Keep old versions in the database with `is_active = false`
2. To rollback, deactivate the current version and activate the previous one

```sql
-- Deactivate current version
UPDATE ai_prompts SET is_active = false WHERE prompt_key = 'chat_system' AND version = 2;

-- Activate previous version
UPDATE ai_prompts SET is_active = true WHERE prompt_key = 'chat_system' AND version = 1;
```

## Migration Files

- `20251110000000_create_ai_prompts_table.sql` - Creates the table structure
- `20251110000001_seed_ai_prompts.sql` - Seeds initial prompts

## Security

- RLS (Row Level Security) is enabled on the `ai_prompts` table
- Service role has full access
- Authenticated users can only read active prompts
- Only service role can modify prompts

## Monitoring

Consider monitoring:
- Prompt fetch failures (check logs for "Failed to fetch prompt" errors)
- Variable replacement errors
- Template syntax issues
- Performance impact of database queries

## Future Enhancements

Potential improvements:
- Version history tracking
- A/B testing framework
- Prompt analytics (which prompts perform better)
- Admin UI for managing prompts
- Prompt validation before saving
- Export/import functionality

