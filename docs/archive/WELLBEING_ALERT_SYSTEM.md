# Student Wellbeing Alert System - Implementation Summary

## Overview
A comprehensive alert system that detects concerning signs in student conversations and notifies teachers through multiple channels.

## ✅ Completed Features

### 1. Database Schema
**File:** `supabase/migrations/20251109000010_create_student_alerts.sql`

Created `student_alerts` table with:
- Alert levels: `concerning` (moderate issues) and `critical` (immediate attention needed)
- Alert types: `struggle`, `self_harm_risk`, `disengagement`, `wants_to_quit`
- Triggered messages with full context and reasoning
- Teacher acknowledgment tracking
- Proper RLS policies for teacher-only access

### 2. Backend - AI Detection System
**Files:**
- `supabase/functions/analyze-student-wellbeing/index.ts` - Main edge function
- `supabase/functions/analyze-student-wellbeing/prompts.ts` - Detection prompts
- `supabase/functions/analyze-student-wellbeing/types.ts` - TypeScript interfaces
- `supabase/functions/analyze-student-wellbeing/email.ts` - Email notification helper

**How it works:**
- Analyzes entire conversation using OpenAI
- Uses educational psychologist persona
- Moderately sensitive detection (balance between false positives/negatives)
- Returns structured JSON with alert level, types, triggered messages, and analysis

### 3. Backend - Integration
**File:** `supabase/functions/generate-feedback/index.ts`

- Integrated into feedback generation process
- Runs after student completes assignment
- Creates alerts in database when concerns detected
- Sends in-app notifications to teacher
- Prepares email notifications (ready for email service integration)

### 4. Frontend - Alert Display
**Files:**
- `src/components/WellbeingAlertCard.tsx` - Reusable alert component
- `src/types/alerts.ts` - TypeScript types

**Features:**
- Prominent display with color-coded severity (red for critical, yellow for concerning)
- Shows AI analysis and triggered messages
- "Acknowledge" functionality for teachers
- Action recommendations based on severity level
- Professional, non-alarming tone

### 5. Frontend - Submission Detail Page
**File:** `src/pages/teacher/SubmissionDetail.tsx`

**4 Notification Channels Implemented:**

1. **Wellbeing Alerts Section** ✅
   - Prominently displayed at top of submission detail page
   - Shows all alerts with full analysis
   - Teacher can acknowledge each alert

2. **In-App Notification** ✅
   - Urgent notification sent to teacher
   - Title varies by severity: "🚨 CRITICAL" or "⚠️ Wellbeing Alert"
   - Clicking navigates to submission with alerts visible

3. **Chat Message Highlighting** ✅
   - Concerning messages highlighted with red border and background
   - Red warning icon badge on flagged messages
   - Shows reason for flagging below each message
   - Visual indicator in conversation history header

4. **Email Notification** ✅ (Ready for email service)
   - Professional HTML email template created
   - Subject line indicates urgency
   - Includes analysis excerpt and direct link
   - Includes action recommendations
   - **Note:** Requires email service API key (Resend recommended)

## Detection Sensitivity

The system uses a **moderate-to-sensitive** approach:

### CRITICAL Alerts (Immediate attention):
- Self-harm mentions (explicit or implicit)
- Suicidal ideation
- Severe emotional distress
- Hopelessness or despair
- Examples: "I want to die", "Nobody would care if I was gone"

### CONCERNING Alerts (Teacher attention needed):
- Severe academic struggle with emotional impact
- Complete disengagement
- Wanting to quit/drop out
- Persistent negative self-talk
- Examples: "I'm so stupid", "I give up", "This is pointless"

### NOT Flagged:
- Normal academic frustration ("This is hard")
- Temporary setbacks
- General assignment complaints

## Testing the System

### Manual Test Flow:
1. **Create an assignment** as a teacher
2. **As a student**, have a conversation with concerning language:
   - For CONCERNING test: "I give up, I'm so stupid at this. I don't want to be in this class anymore."
   - For CRITICAL test: "I can't take this anymore. What's the point of living? Nobody would care."
3. **Complete the assignment** to trigger feedback generation
4. **Wait for processing** (30-60 seconds for OpenAI analysis)
5. **Check as teacher:**
   - Notifications bell (should have urgent notification)
   - Click notification to go to submission
   - See wellbeing alert card at top
   - See red-highlighted messages in chat history
   - Try acknowledging alerts

### Database Verification:
```sql
-- Check if alerts were created
SELECT * FROM student_alerts ORDER BY created_at DESC;

-- Check triggered messages
SELECT 
  alert_level,
  alert_type,
  ai_analysis,
  triggered_messages
FROM student_alerts;
```

## Email Service Integration (TODO)

The email functionality is implemented but requires an email service API key:

### Recommended: Resend
1. Sign up at https://resend.com
2. Get API key
3. Add to Supabase environment variables:
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```
4. Uncomment email sending code in:
   `supabase/functions/analyze-student-wellbeing/email.ts` (lines marked with TODO)

### Alternative: SendGrid, Mailgun, etc.
Modify the email helper to use your preferred service.

## Security & Privacy

- ✅ RLS policies ensure teachers only see alerts for their students
- ✅ Alerts tied to classroom ownership
- ✅ AI analysis stored for teacher reference
- ✅ Student doesn't see alerts (teacher-only)
- ✅ Professional, non-stigmatizing language

## Future Enhancements (Not in MVP)

1. **Real-time detection** - Analyze during conversation, not just at end
2. **Escalation workflow** - Involve counselors or administrators
3. **Historical patterns** - Track student wellbeing over time
4. **Custom thresholds** - School-specific sensitivity settings
5. **Resources library** - Suggested support resources for teachers
6. **Anonymous reporting** - Allow students to self-report concerns

## File Structure Summary

```
supabase/
  migrations/
    20251109000010_create_student_alerts.sql
  functions/
    analyze-student-wellbeing/
      index.ts         (main detection function)
      prompts.ts       (AI prompts with sensitivity guidelines)
      email.ts         (email notification helper)
      types.ts         (TypeScript interfaces)
    generate-feedback/
      index.ts         (modified to integrate alerts)
      wellbeing-email-helper.ts (re-export)

src/
  types/
    alerts.ts         (frontend TypeScript types)
  components/
    WellbeingAlertCard.tsx (alert display component)
  pages/
    teacher/
      SubmissionDetail.tsx (updated with alerts & highlighting)
```

## Important Notes

1. **This is serious functionality** - Always treat alerts with appropriate urgency
2. **False positives possible** - Use professional judgment
3. **Not a replacement** - This supplements, not replaces, professional mental health services
4. **Privacy matters** - Handle alert data with care and confidentiality
5. **Email service required** - Complete email integration for production use

## Success Criteria ✅

All requirements met:
- ✅ Detects 4 types of concerning signs
- ✅ Two-level severity classification
- ✅ 4 notification channels implemented
- ✅ Professional, well-organized code
- ✅ Ready for future improvements
- ✅ Teacher can acknowledge alerts
- ✅ Visual highlighting of concerning messages
- ✅ Comprehensive AI analysis

---

**Implementation Status:** Complete (MVP)
**Ready for:** Testing and email service integration
**Next Step:** Add RESEND_API_KEY to enable email notifications

