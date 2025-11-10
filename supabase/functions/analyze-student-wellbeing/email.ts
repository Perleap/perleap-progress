/**
 * Email Notification Helper
 * Send wellbeing alerts to teachers via email
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { logInfo, logError } from '../shared/logger.ts';
import type { AlertLevel } from './types.ts';

/**
 * Send wellbeing alert email to teacher
 */
export const sendAlertEmail = async (
  teacherUserId: string,
  studentName: string,
  assignmentTitle: string,
  alertLevel: AlertLevel,
  analysis: string,
  submissionId: string,
): Promise<boolean> => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get teacher's email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      teacherUserId,
    );

    if (userError || !userData.user?.email) {
      logError('Failed to get teacher email', { teacherUserId, error: userError });
      return false;
    }

    const teacherEmail = userData.user.email;
    const appUrl = Deno.env.get('PUBLIC_APP_URL') || 'http://localhost:5173';
    const submissionUrl = `${appUrl}/teacher/submission/${submissionId}`;

    // Compose email
    const subject = alertLevel === 'critical'
      ? `[URGENT] Critical Student Wellbeing Alert - ${studentName}`
      : `[ACTION NEEDED] Student Wellbeing Alert - ${studentName}`;

    const urgencyText = alertLevel === 'critical'
      ? 'CRITICAL - IMMEDIATE ATTENTION REQUIRED'
      : 'CONCERNING - PLEASE REVIEW';

    const analysisExcerpt = analysis.length > 300 
      ? analysis.substring(0, 297) + '...'
      : analysis;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${alertLevel === 'critical' ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .urgency { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #6b7280; }
    .analysis { background-color: white; padding: 15px; border-left: 4px solid ${alertLevel === 'critical' ? '#dc2626' : '#f59e0b'}; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: ${alertLevel === 'critical' ? '#dc2626' : '#f59e0b'}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px; }
    .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="urgency">${urgencyText}</div>
      <h2 style="margin: 10px 0 0 0;">Student Wellbeing Alert</h2>
    </div>
    <div class="content">
      <p>A wellbeing alert has been detected for one of your students during an assignment conversation.</p>
      
      <div class="detail-row">
        <span class="label">Student:</span> ${studentName}
      </div>
      <div class="detail-row">
        <span class="label">Assignment:</span> ${assignmentTitle}
      </div>
      <div class="detail-row">
        <span class="label">Alert Level:</span> <strong style="color: ${alertLevel === 'critical' ? '#dc2626' : '#f59e0b'};">${alertLevel.toUpperCase()}</strong>
      </div>
      
      <div class="analysis">
        <strong>Analysis Summary:</strong>
        <p>${analysisExcerpt}</p>
      </div>
      
      <p><strong>Recommended Action:</strong> ${
        alertLevel === 'critical'
          ? 'Please contact this student immediately to provide support and ensure their safety. Consider involving school counseling services or mental health professionals.'
          : 'Please reach out to this student to check in on their wellbeing and provide appropriate support.'
      }</p>
      
      <a href="${submissionUrl}" class="button">View Full Details &rarr;</a>
      
      <div class="footer">
        <p>This is an automated alert from the Perleap student wellbeing monitoring system. The analysis is based on conversation patterns and AI assessment. Always use your professional judgment when evaluating student needs.</p>
        <p>If you believe a student is in immediate danger, please contact emergency services or your institution's crisis response team.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const textBody = `
${urgencyText}

Student Wellbeing Alert Detected

Student: ${studentName}
Assignment: ${assignmentTitle}
Alert Level: ${alertLevel.toUpperCase()}

Analysis:
${analysis}

Recommended Action:
${alertLevel === 'critical'
  ? 'Please contact this student immediately to provide support and ensure their safety. Consider involving school counseling services or mental health professionals.'
  : 'Please reach out to this student to check in on their wellbeing and provide appropriate support.'
}

View full details: ${submissionUrl}

---
This is an automated alert from the Perleap student wellbeing monitoring system.
If you believe a student is in immediate danger, please contact emergency services.
    `;

    // TODO: Integrate with email service (add RESEND_API_KEY to environment variables)
    // Uncomment below and add your email service integration:
    /*
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Perleap Alerts <alerts@perleap.com>',
          to: [teacherEmail],
          subject,
          html: htmlBody,
          text: textBody,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Email send failed: ${await response.text()}`);
      }
      
      logInfo('Alert email sent', { to: teacherEmail, submissionId });
      return true;
    }
    */

    logInfo('Alert email prepared', { to: teacherEmail, subject });
    return true;
  } catch (error) {
    logError('Error sending alert email', error);
    return false;
  }
};

