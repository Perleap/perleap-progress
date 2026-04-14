# Branded auth email and `perleap.ai` sender (Supabase)

Auth confirmation and password emails are sent by **Supabase Auth**, not the React app. To change appearance and the “from” address you configure the **Supabase Dashboard** and (for a custom domain) **custom SMTP** plus **DNS** on `perleap.ai`.

## 1. Custom SMTP (sender `perleap.ai`)

1. Choose a transactional provider (e.g. **Resend**, **SendGrid**, **Postmark**, **AWS SES**).
2. Verify the domain **`perleap.ai`** with that provider (SPF + DKIM records they give you).
3. In Supabase: **Project Settings → Authentication** (or **Authentication → Emails** depending on UI version) → enable **Custom SMTP**.
4. Enter the provider’s SMTP host, port, user, password/API key, and set:
   - **Sender email**: e.g. `noreply@perleap.ai` or `hello@perleap.ai` (must be allowed by the provider).
   - **Sender name**: e.g. `Perleap`.
5. Save and send a **test** email from the dashboard if available.

Until SMTP is configured and DNS has propagated, mail may continue from Supabase’s default infrastructure.

## 2. HTML email templates

1. In Supabase: **Authentication → Email templates**.
2. Edit at least **Confirm signup** (and optionally **Magic link**, **Reset password**, **Change email address** for a consistent brand).
3. Paste HTML (see [supabase-auth-email-confirm.html](./supabase-auth-email-confirm.html) in this repo as a **reference** to copy into the dashboard).
4. Use the **exact** confirmation link variable shown in the Supabase editor for your project (commonly `{{ .ConfirmationURL }}`). Do not invent URLs; the template must use Supabase’s variable so the link stays valid.

The HTML file in this repo is **not** served by the app; it is only a version-controlled reference for what you paste into Supabase.

## 3. After changes

- Sign up with a test address and confirm the message is from your SMTP sender and renders as expected.
- Check spam placement once; fix SPF/DKIM if needed.

## 4. Signup / email “rate limit” (429) during development

The Perleap app **cannot turn off** Supabase Auth’s email or signup rate limits; those are enforced on Supabase’s servers (per IP / project / time window) to prevent abuse.

**Practical options:**

- **Wait a few minutes** between bursts of signup tests on the same Wi‑Fi.
- **Use another network** (e.g. mobile hotspot) so your IP is not in the same throttled bucket.
- **Custom SMTP** (section 1) can change deliverability and sometimes how aggressively default limits feel; limits still exist—see current [Supabase Auth rate limit documentation](https://supabase.com/docs/guides/auth/rate-limits).
- **Local Supabase** (`supabase start`) for day‑to‑day dev removes dependency on hosted project quotas for local URLs (still has sensible local limits).

There is no safe client-side “remove rate limit” switch in production; only Supabase/project configuration and testing habits change the experience.
