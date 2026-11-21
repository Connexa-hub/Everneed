# Production authentication setup

> **Owner-friendly walkthrough:** see [Account creation, email verification and social sign-in](../OWNER_GUIDES/ACCOUNT_SIGN_IN_EMAIL_AND_OAUTH.md) for the step-by-step user journey and dashboard instructions. This file is the shorter technical checklist.

This checklist is for the Everneed website and the shared Supabase Auth service. The website already implements email/password signup, six-digit signup verification, resend-code handling, password visibility, and provider-aware social buttons. Supabase remains the identity and verification system; an external email provider only delivers its messages.

## 1. Transactional email delivery

**Use Resend as the first SMTP provider.** Its current free plan lists 3,000 emails per month with a 100-email daily limit. Supabase's built-in SMTP is for testing only: it sends only to addresses belonging to the Supabase organisation team and is limited to 2 messages per hour. Do not launch public registration on the built-in sender.

1. Create a Resend account and add a domain or subdomain that Everneed controls (for example, a dedicated mail subdomain).
2. Add the DNS records Resend provides for domain verification and sending authentication. Wait until the domain is verified.
3. Create a Resend API key for SMTP use. Never put this key in GitHub, website JavaScript, or a public environment variable.
4. In the Supabase dashboard for the project being configured, open **Authentication → SMTP Settings** and enable custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL)
   - Username: `resend`
   - Password: the Resend API key
   - Sender name: `Everneed`
   - Sender email: an address on the verified sending domain, e.g. `no-reply@mail.your-owned-domain`
5. Keep email confirmations enabled. Do not enable auto-confirm for public signup.
6. Repeat for staging with its own sender configuration if staging needs to send to arbitrary test addresses. Do not copy production credentials into the repository.

Resend pricing: https://resend.com/pricing  
Resend SMTP details: https://resend.com/changelog/smtp-service  
Supabase SMTP setup: https://supabase.com/docs/guides/auth/auth-smtp

## 2. Six-digit signup confirmation template

The current website asks the new user to enter a six-digit code and calls Supabase's signup verification endpoint. Therefore, the Supabase **Confirm signup** email template must contain `{{ .Token }}`, not only `{{ .ConfirmationURL }}`.

Suggested subject:

`Your Everneed verification code`

Suggested HTML:

```html
<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;color:#17231d">
  <h2 style="margin:0 0 12px">Confirm your Everneed account</h2>
  <p style="line-height:1.6">Use this one-time code to verify your email address and finish creating your account.</p>
  <div style="margin:28px 0;padding:20px;text-align:center;background:#f0f6f1;border-radius:14px;font-size:32px;font-weight:700;letter-spacing:10px;color:#174b35">{{ .Token }}</div>
  <p style="line-height:1.6">If you did not request an Everneed account, you can ignore this email.</p>
  <p style="margin-top:28px;color:#718078;font-size:12px">Everneed · A marketplace for everyday discovery</p>
</div>
```

Keep the code expiry and resend limits at safe defaults while testing. The confirmation template is separate from the magic-link template; changing the wrong template will not fix signup verification.

Template documentation: https://supabase.com/docs/guides/auth/auth-email-templates

## 3. Google sign-in

The website checks the Supabase Auth settings endpoint at runtime. A provider is displayed in its native brand colours only when Supabase reports that provider as enabled. Providers that are not enabled remain grey and explain that the option is not available yet when tapped.

To enable Google:

1. In Google Cloud Console, create an OAuth client with application type **Web application**.
2. Add the website origins that will be used for sign-in (production and the active preview host).
3. Add the exact Supabase callback URL shown on the Supabase Google provider settings page. For this project it follows this form:
   `https://zpgasfweaixwsktlueje.supabase.co/auth/v1/callback`
4. Copy the Google client ID and client secret into **Supabase → Authentication → Sign In / Providers → Google**. Enable Google and save.
5. Add the production and preview return URLs to Supabase's Auth redirect allow list. Keep the production Site URL set to the production website.
6. Test a fresh Google account and an existing email/password account before enabling the provider on the production project.

Google setup guide: https://supabase.com/docs/guides/auth/social-sign-in/auth-google  
Supabase redirect URL guide: https://supabase.com/docs/guides/auth/redirect-urls

Apple, Facebook, and other providers each require their own developer-console credentials and Supabase provider configuration. Keep them disabled until those credentials and callback settings have been verified.

## 4. Required end-to-end release checks

- A new, non-team email address receives the confirmation message.
- The six-digit code verifies the signup and creates a usable session.
- An incorrect or expired code shows a clear error; resend works within provider rate limits.
- Unconfirmed users cannot sign in.
- A confirmed email/password user can sign in and sign out.
- Google OAuth returns to the website with a valid session and the correct user role.
- Unconfigured providers remain grey and show the unavailable message.
- Test staging against `Everneed-staging` first. Do not use real customer addresses or production data for staging tests.

## 5. Production database caution

At the time this checklist was added, staging had migrations through `018`, while the live `Everneed01` project had migrations through `015`. Migrations `016`–`018` are security and public-form boundary changes. Review their code and staging test results, then prepare a separately approved live migration plan. Do not replay or reset the live database as a shortcut.
