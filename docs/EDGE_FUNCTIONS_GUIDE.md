# Edge Functions Deployment Guide

## 📋 Overview

Perleap uses **5 Supabase Edge Functions** that power the AI-driven features. These **MUST be deployed** for the application to work properly.

## 🔧 Edge Functions List

### 1. **`perleap-chat`** ⭐ CRITICAL
- **Purpose**: Powers the AI chat interface for student assignments
- **Uses**: OpenAI GPT-4 for interactive learning conversations
- **Features**: 
  - Personalized greeting based on teacher context
  - Assignment-specific guidance
  - Conversation history tracking
- **Required for**: All student assignment interactions

### 2. **`generate-feedback`** ⭐ CRITICAL
- **Purpose**: Generates AI feedback for student submissions
- **Uses**: OpenAI GPT-4 for analysis
- **Features**:
  - Student-facing feedback
  - Teacher-facing feedback
  - 5D dimension scores (Vision, Values, Thinking, Connection, Action)
  - Hard skills assessment
- **Required for**: Assignment grading and feedback

### 3. **`regenerate-scores`** ⭐ IMPORTANT
- **Purpose**: Regenerates 5D scores for existing submissions
- **Uses**: OpenAI GPT-4 for scoring
- **Features**:
  - Recalculate dimension scores
  - Update student analytics
- **Required for**: Score recalculation feature

### 4. **`generate-followup-assignment`** 🎯 IMPORTANT
- **Purpose**: AI-generates personalized follow-up assignments
- **Uses**: OpenAI GPT-4 for assignment creation
- **Features**:
  - Based on student performance
  - Targeted to weak dimensions
  - Customized instructions
- **Required for**: Follow-up assignment generation

### 5. **`analyze-student-wellbeing`** 🧠 IMPORTANT
- **Purpose**: Analyzes student wellbeing from submissions
- **Uses**: OpenAI GPT-4 for sentiment analysis
- **Features**:
  - Detects concerning patterns
  - Sends email alerts to teachers
  - Tracks wellbeing over time
- **Required for**: Wellbeing monitoring feature

---

## 🚀 Deployment Instructions

### Prerequisites

1. **Supabase CLI** installed:
```bash
npm install -g supabase
```

2. **Login to Supabase**:
```bash
supabase login
```

3. **Link to your project**:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Set Environment Variables

Before deploying, set the OpenAI API key in your Supabase project:

1. Go to **Supabase Dashboard** → **Project Settings** → **Edge Functions**
2. Add these secrets:

```bash
# Via CLI (recommended)
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key
supabase secrets set OPENAI_MODEL=gpt-4-turbo-preview  # Optional, defaults to gpt-4-turbo-preview

# Or via Dashboard UI
# Navigate to Settings > Edge Functions > Secrets
```

### Deploy All Functions

**Option 1: Deploy all at once** (recommended for first deployment):

```bash
# Navigate to project root
cd perleap-progress

# Deploy all functions
supabase functions deploy perleap-chat
supabase functions deploy generate-feedback
supabase functions deploy regenerate-scores
supabase functions deploy generate-followup-assignment
supabase functions deploy analyze-student-wellbeing
```

**Option 2: Deploy individually** (for updates):

```bash
# Deploy specific function
supabase functions deploy perleap-chat

# With custom flags
supabase functions deploy perleap-chat --no-verify-jwt  # If needed
```

### Verify Deployment

```bash
# List deployed functions
supabase functions list

# Check function logs
supabase functions logs perleap-chat
supabase functions logs generate-feedback
```

---

## 🧪 Testing Edge Functions

### Test Locally (Optional)

```bash
# Start Supabase locally
supabase start

# Serve a function locally
supabase functions serve perleap-chat --env-file .env.local

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/perleap-chat' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"message":"Hello"}'
```

### Test Deployed Functions

Use the Supabase Dashboard:
1. Go to **Edge Functions**
2. Select a function
3. Click **Invoke Function**
4. Send test payload

---

## 📊 Monitoring & Logs

### View Logs

```bash
# Real-time logs
supabase functions logs perleap-chat --follow

# Last 100 logs
supabase functions logs generate-feedback --limit 100

# Filter by time
supabase functions logs regenerate-scores --since 1h
```

### Dashboard Monitoring

1. Go to **Supabase Dashboard** → **Edge Functions**
2. View:
   - Invocation count
   - Success/error rates
   - Execution time
   - Resource usage

---

## 🔐 Security & Permissions

### Row Level Security (RLS)

Edge functions use the **service role key** which bypasses RLS. They have full database access.

### API Keys

- **Anon Key**: Frontend → Edge Functions
- **Service Role Key**: Edge Functions → Database (automatic)
- **OpenAI API Key**: Edge Functions → OpenAI (set via secrets)

### Best Practices

1. ✅ **Never expose service role key** in frontend
2. ✅ **Validate all inputs** in edge functions
3. ✅ **Use proper authentication** via Supabase Auth
4. ✅ **Rate limit** API calls to OpenAI
5. ✅ **Handle errors gracefully**

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "Function not found" error
```bash
# Solution: Deploy the function
supabase functions deploy function-name
```

#### 2. "OpenAI API key not set" error
```bash
# Solution: Set the secret
supabase secrets set OPENAI_API_KEY=your-key
```

#### 3. "Failed to fetch prompt" error
```bash
# Solution: Run the AI prompts migration
# In Supabase SQL Editor, run:
# - 20251110000000_create_ai_prompts_table.sql
# - 20251110000001_seed_ai_prompts.sql
```

#### 4. CORS errors
```bash
# Solution: Update function to include CORS headers
# Already handled in existing functions
```

#### 5. Timeout errors
```bash
# Solution: Increase timeout or optimize function
# Default timeout: 30s, max: 300s
```

---

## 💰 Cost Considerations

### Supabase Edge Functions
- **Free tier**: 500K function invocations/month
- **Pro tier**: 2M invocations/month
- **Beyond limits**: $2 per 1M invocations

### OpenAI API Costs
- **GPT-4 Turbo**: ~$0.01-0.03 per request (depends on length)
- **Typical costs**:
  - Chat: $0.01-0.02 per message
  - Feedback generation: $0.02-0.05 per submission
  - Wellbeing analysis: $0.01-0.03 per analysis

**Tip**: Monitor usage in OpenAI Dashboard to avoid surprises!

---

## 📝 Updating Functions

### After Code Changes

1. **Make changes** to function code in `supabase/functions/`
2. **Test locally** (optional but recommended)
3. **Deploy updated function**:
```bash
supabase functions deploy function-name
```
4. **Verify** via logs or testing

### Database Schema Changes

If you update the `ai_prompts` table or add new prompts:

1. Update migration files in `supabase/migrations/`
2. Run migrations:
```bash
supabase db push
```
3. Redeploy affected functions

---

## 🎯 Quick Deployment Checklist

Before going live, ensure:

- [ ] All 5 edge functions deployed
- [ ] OpenAI API key set in secrets
- [ ] AI prompts seeded in database
- [ ] Functions tested with sample data
- [ ] Error handling verified
- [ ] Logs monitored for errors
- [ ] CORS configured (if needed)
- [ ] Rate limiting considered
- [ ] Cost monitoring set up

---

## 📚 Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Deploy Docs](https://docs.deno.com/deploy/manual)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [AI Prompts README](../supabase/functions/_shared/PROMPTS_README.md)

---

## 🆘 Getting Help

If you encounter issues:

1. **Check logs**: `supabase functions logs function-name`
2. **Review error messages** in Supabase Dashboard
3. **Test locally** to isolate the issue
4. **Check OpenAI status**: https://status.openai.com
5. **Verify secrets** are set correctly

---

*Last updated: November 2025*

