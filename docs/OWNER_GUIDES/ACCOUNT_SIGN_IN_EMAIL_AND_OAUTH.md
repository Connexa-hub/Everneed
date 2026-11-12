# Everneed owner guide: account creation, email verification and social sign-in

**Audience:** Everneed founder / project owner  
**Purpose:** Explain the account journey and the dashboard setup required to make it work.

## 1. How account creation works

Everneed uses Supabase Auth as its identity system. The website does not store passwords itself. Resend is only the email delivery service; it does not create accounts or verify passwords.

1. A visitor opens the real Everneed homepage and chooses **Create account**.
2. The dedicated screen collects name, email address and password, then asks the visitor to review the details.
3. On submission, Supabase creates an unconfirmed account and sends a one-time confirmation email.
4. The visitor enters the six-digit code on Everneed.
5. Supabase verifies the code. Only then should the account become confirmed and receive a valid session.
6. The website routes the user using trusted profile/backend role information.

## 2. How sign-in works

1. A returning user chooses **Sign in** from the homepage.
2. They enter their account email and password. The eye control reveals or hides the password.
3. Supabase checks the credentials.
4. A confirmed account receives a session and is routed according to its authorised role.
5. If the email is not confirmed, the user must complete email verification first.

A frontend button or hidden page is never a security boundary. Supabase policies and backend role checks remain authoritative.

## 3. Understand staging and production

| Environment | Supabase project | Reference | Purpose |
|---|---|---|---|
| Development / preview | Everneed-staging | vjiadqygpyebpisxslbx | Develop and test against a production-compatible schema and configuration, using test accounts and test data |
| Production / live | Everneed01 | zpgasfweaixwsktlueje | Real user accounts and live marketplace data |

Staging is a separate development database intended to mirror production's schema, migrations, policies and expected backend behaviour. It lets us develop against the production design without risking real customer records. Keep schema and migrations aligned, but use separate Auth users, secrets, payment test credentials and test data.

**Important:** staging is not a safe alias for the live database. Preview and local development must use staging. Do not copy real customer records into staging or point a staging build at live data. Production changes are promoted only after staging verification and owner approval.

The website selects its project from the hostname:
- localhost and *.everneed.pages.dev preview hosts use staging.
- The production host and configured production custom domains use live.
- Check the yellow staging ribbon before creating test accounts or testing checkout.

The Android app still has a separate configuration gap recorded as APP-08 in the project tracker. Do not assume Android test builds already use staging until that task is completed.

## 4. Set up Resend and custom SMTP

Resend sends Supabase's transactional emails. Supabase remains responsible for generating and verifying confirmation tokens.

1. Create an account at https://resend.com/.
2. Add a domain or dedicated subdomain that Everneed controls. Do not use a domain you do not own.
3. Resend provides DNS records for domain verification and email authentication (SPF and DKIM, plus any recommended DMARC record). Add the exact records at the domain's DNS provider.
4. Wait until Resend reports the sending domain as verified.
5. Create an SMTP API key in Resend. Store it in a password manager. Never put it in frontend JavaScript, shared/config.js, Git commits, screenshots or chat.
6. Configure SMTP in the **staging Supabase project first**: Supabase Dashboard → Everneed-staging → Authentication → SMTP Settings. Enable custom SMTP and enter:
   - Host: smtp.resend.com
   - Port: 465 (SSL)
   - Username: resend
   - Password: your Resend API key
   - Sender name: Everneed
   - Sender email: an address on the verified domain, such as no-reply@mail.your-domain
7. Save, then test a staging signup to an inbox that is not part of the Supabase organisation.
8. Once staging delivery and the full OTP journey pass, configure the production Everneed01 project separately. Settings do not automatically carry between projects.

Resend pricing: https://resend.com/pricing  
Resend SMTP guide: https://resend.com/docs/send-with-smtp  
Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp

Supabase's default email sender is for limited testing, not public production signup. Do not launch public registration until custom SMTP and a verified sending domain work.

## 5. Configure the six-digit confirmation email

In the **staging** Supabase dashboard:

1. Open Authentication → Email Templates → Confirm signup.
2. Set the subject to **Your Everneed verification code**.
3. Make sure the template includes the Supabase token variable **{{ .Token }}**. The website expects a six-digit code and submits it for signup verification. A template containing only the confirmation URL does not match this code-entry journey.
4. Save the template. Keep email confirmation enabled; do not enable auto-confirm for public registration.
5. Keep sensible token expiry and resend limits.

Suggested email copy:

Subject: Your Everneed verification code

Confirm your Everneed account

Use this one-time code to verify your email address and finish creating your account.

{{ .Token }}

If you did not request an Everneed account, you can ignore this email.

Everneed

Test with a brand-new email address. Check Inbox, Spam and Promotions. Confirm that the code arrives, is six digits, is accepted once, and that an expired or incorrect code produces a clear error. Test resend within the configured rate limits.

Supabase email templates: https://supabase.com/docs/guides/auth/auth-email-templates

## 6. Configure Google sign-in

Do this in staging first. Google sign-in requires a Google OAuth client and matching Supabase settings.

### A. Create the Google OAuth client

1. Open https://console.cloud.google.com/.
2. Select or create the Google Cloud project for Everneed.
3. Configure the OAuth consent screen / Google Auth Platform branding and audience as required by Google's current console.
4. Create an OAuth client ID with application type **Web application**.
5. Add the staging preview origin to Authorised JavaScript origins:
   https://web-portal.everneed.pages.dev
6. Add the exact callback URL shown in the staging Supabase Google provider panel to Authorised redirect URIs. For the current staging project:
   https://vjiadqygpyebpisxslbx.supabase.co/auth/v1/callback
7. Save and copy the OAuth client ID and client secret. Keep the client secret private.

### B. Configure Supabase staging

1. Open Supabase → Everneed-staging → Authentication → Sign In / Providers → Google.
2. Enable Google, paste the client ID and client secret, then save.
3. Open Authentication → URL Configuration.
4. Set the staging Site URL to:
   https://web-portal.everneed.pages.dev
5. Add only the exact staging return URLs required by the website to Redirect URLs. Avoid broad wildcards for unrelated domains.
6. Test in a fresh private browser session.

### C. Test before production

- Click Google on the staging sign-in page.
- Complete Google's consent/sign-in and confirm the browser returns to staging, not production.
- Confirm Supabase recognises the account and the website obtains a valid session.
- Confirm the correct route is chosen from trusted backend profile data.
- Sign out and repeat with the same Google account.
- Test what happens if the same email already has a password account. Do not assume identities are automatically linked.
- Confirm production data was not involved.

Google + Supabase guide: https://supabase.com/docs/guides/auth/social-login/auth-google  
Supabase redirect URL guide: https://supabase.com/docs/guides/auth/redirect-urls

### D. Configure production after staging passes

Create/configure the production OAuth client settings with the production website origin and production Supabase callback:
https://zpgasfweaixwsktlueje.supabase.co/auth/v1/callback

Then enter those credentials in Supabase → Everneed01 → Authentication → Sign In / Providers → Google. Set the production Site URL and allow only real production return URLs. Test only with an owner-approved account.

## 7. Apple, Facebook and other providers

Each provider requires its own developer-console account, application ID/key/secret, callback URL and Supabase configuration. A button alone does not enable a provider.

Until credentials, callback settings and the full sign-in/session flow are verified, keep that provider disabled. The website should show disabled providers in grey and explain that the option is not available yet. Only enable a provider after staging tests pass.

## 8. Release checklist

- [ ] Staging SMTP verified with an external inbox.
- [ ] Confirm signup template contains {{ .Token }}.
- [ ] New signup receives a six-digit code.
- [ ] Correct code verifies the account and establishes a session.
- [ ] Incorrect and expired codes are rejected; resend respects rate limits.
- [ ] Unconfirmed accounts cannot complete normal sign-in.
- [ ] Confirmed account can sign in, refresh session and sign out.
- [ ] Password reset/recovery is implemented and tested before public launch.
- [ ] Google callback matches staging and returns to staging.
- [ ] Existing account linking has been tested.
- [ ] Production OAuth and SMTP are configured separately only after staging passes.
- [ ] Preview displays the staging ribbon and never uses Everneed01.
- [ ] No SMTP password, OAuth secret or service-role key is committed to GitHub.

## 9. Current readiness boundary

A code implementation of the screens does not mean the email service or OAuth credentials are configured. The owner must complete the dashboard steps and test with real inboxes. Treat email/OAuth setup as pending until the checklist is evidenced.

Password reset/recovery also needs explicit implementation and testing before the account system is production-ready.
