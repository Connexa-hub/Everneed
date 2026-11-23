# Everneed staging — login and payment integration test plan

**Target:** `web-portal` and Android staging build only.  
**Production:** No provider settings, secrets, charges, migrations or deployments are changed by this checklist.

## Read-only staging baseline verified 23 Nov 2026

- Everneed-staging migration ledger currently includes 026–033 and newer timestamped checkout/finance migrations through `20261122140408_fin03_verified_payment_journal_posting`.
- Staging `paystack` Edge Function is ACTIVE version 14, `verify_jwt=false`; its source includes snapshot-backed card order creation (`create_order_with_financial_snapshot_v2)), payment-attempt creation, verified settlement, and durable provider-event inbox handling.
- The deployed function source hash reported by Supabase is `6a6ce92bbe70ece6b8f1bf60986e3c1bac84ef91bdd7bcc977287fe55f7bfdef`.
- This confirms the core card-payment backend is already present in staging. It does **not** prove a test charge, webhook round-trip, retry/reconciliation or refund has been tested.
- Provider secrets were not read. No database or Edge Function deployment/change was made during this inspection.

## Authentication (Google)

### Staging setup — owner action
- [ ] Enable Google provider in Everneed-staging Supabase Auth.
- [ ] Add Google OAuth client ID and secret to the staging provider settings.
- [ ] Google OAuth client: add the active staging website origin and the Supabase callback URL shown in the provider settings.
- [ ] Supabase Auth redirect allow-list: add the staging website redirect(s) and exact native URI `com.everneed.store://auth/callback`.
- [ ] Confirm staging app uses the staging Supabase project (yellow staging ribbon visible).

### Test cases
- [ ] Existing test account can sign in with Google and is routed to the correct account/home.
- [ ] New Google account completes name/country/DOB; under-18 account is blocked.
- [ ] Cancelled provider flow shows a clear message and leaves no invalid session.
- [ ] Invalid, duplicate or expired callback is rejected; PKCE verifier is consumed once.
- [ ] Android cold-start callback and warm app callback both restore the session.
- [ ] Sign out clears the session; sign-in again works.
- [ ] Email/password and six-digit email verification remain working.

## Paystack card checkout

### Safety prerequisites
- [ ] Android/web build points to Everneed-staging and shows staging banner.
- [ ] Staging Edge Function has test-only Paystack secret and matching current code deployed **only after explicit staging deployment approval**.
- [ ] Staging migrations/contracts required by snapshot-backed card checkout are verified applied.
- [ ] Use a Paystack test card only; no live keys or real funds.

### Test cases
- [ ] New card order creates server-priced immutable checkout snapshot.
- [ ] Initialisation creates an attempt with exact amount/currency/reference.
- [ ] Repeat initialization for the same order reuses the attempt/reference; no second charge session.
- [ ] Browser/app cancellation leaves cart recoverable.
- [ ] Returning to the app and checking status confirms a completed test payment.
- [ ] Delayed/duplicate webhook and manual verify settle only once.
- [ ] Provider pending/ambiguous state never appears as paid and never prompts a duplicate charge.
- [ ] Failed attempt offers explicit retry with a fresh idempotency key.
- [ ] Retry uses the frozen quote; it cannot silently reprice.
- [ ] Saved-card charge is owner-bound and failure allows safe retry.
- [ ] Multi-seller order settlement produces expected seller package/ledger effects exactly once.

## Not covered / separate release gates
- Pay-on-delivery delayed charge still follows a legacy path.
- Provider-confirmed refunds are not complete.
- Recovery worker scheduling/deployment and stale-attempt monitoring are not complete.
- Seller payouts/Paystack transfers are not implemented/approved.
- No production readiness claim until staging end-to-end and reconciliation tests pass.
