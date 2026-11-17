# Ninja verification + Paystack completion — staging integration contract

**Owner decision:** Ninja is Everneed's first verification provider.  
**Target branch:** `web-portal` only.  
**Staging project:** `vjiadqygpyebpisxslbx`.  
**Production:** Do not change or deploy until the owner approves after end-to-end testing.

## 1. Current verified state

### Seller frontend (Claude)
- The four-step store setup, plan carousel, plan-directed seller screens, and commerce-first overview are present on `web-portal`.
- Claude's frontend report records 22/22 harness checks passing.
- The seller verification screen in `web/assets/js/seller-flow.js` still tells sellers that checks cannot be started because no provider is connected. It has no action that obtains a provider link.
- The frontend report's backend section is now stale: migration `20261117054738` has been applied to staging; `seller_plan_catalog()` exists; `approve_store()` now carries the seller-selected plan into the trial subscription.
- Owner/device visual checks and a complete new-account click-through remain outstanding.

### Paystack (existing implementation, not yet release-ready)
- `js/cards.js` already loads Paystack Inline JS v2 from `https://js.paystack.co/v2/inline.js`, resumes the server-created transaction with `PaystackPop().resumeTransaction(access_code)`, and asks the backend to verify the reference after the SDK success callback. Do not add a second payment SDK or duplicate this flow.
- `supabase/functions/paystack/index.ts` contains server-side order creation, immutable checkout snapshots, payment-attempt creation, transaction initialization, verification and signed-webhook handling.
- Staging has migrations 026–033 and the later seller migrations. The deployed staging `paystack` function is ACTIVE v1 with JWT verification disabled for the webhook route; user actions validate their bearer token inside the function.
- The existing frontend has no complete Paystack subscription checkout path for seller plan upgrades/renewals. `choose_plan` is plan selection, not payment; the UI currently explains that a paid plan change needs payment which is not available there yet.
- Do not call an order paid from a browser callback. Always verify server-side against Paystack and reconcile exact reference, amount, currency, owner and attempt.
- The current CI state for the last checked commit: Migration files passed; Web checks passed; Android build failed. Investigate the build log before calling the release ready.

## 2. Ninja integration choice

Use Ninja's **Hosted KYC** and **Hosted KYB** links, not direct browser submission of NIN/BVN/CAC data.

- KYC flow: individual identity verification (NIN/BVN and configured supported ID fields), with selfie match and liveness enabled in the flow where the provider supports it.
- KYB flow: CAC certificate verification for incorporated sellers. Configure the required CAC evidence and any proof-of-address/director steps deliberately in Ninja's dashboard.
- Ninja sends signed `verification.completed` and `kyb_verification.completed` webhooks. The webhook is the source of truth; the redirect query string is UX only.
- Preserve `review` as a distinct human-review state. It is not a pass and not a hard failure.
- Do not store ID numbers, CAC documents, selfies, full registry records, or other unnecessary PII in Everneed. Store only the provider/session reference, check type, outcome, timestamps, environment and a short safe note.
- Phone OTP remains a separate capability; do not claim Ninja has verified a phone number just because an identity or CAC check passed.
- CAC is applicable to incorporated businesses. Do not force an unregistered individual/sole proprietor to fabricate a CAC number; route that business type through the approved alternative/manual-review policy.

Official integration reference: https://www.ninja.ng/docs/

## 3. Staging secrets and flow configuration

Create the two reusable flows in Ninja **Sandbox** mode first. Set the flow webhook URL to the staging Supabase function endpoint:

`https://vjiadqygpyebpisxslbx.supabase.co/functions/v1/ninja-verification`

Required Supabase **staging** Edge Function secrets (never commit them, put them in frontend config, or send them in chat):

- `NINJA_SECRET_KEY` — sandbox secret key (`sk_sandbox_...`)
- `NINJA_KYC_FLOW_ID` — KYC flow id (`vf_...`)
- `NINJA_KYB_FLOW_ID` — KYB flow id (`kf_...`)
- `NINJA_KYC_WEBHOOK_SECRET` — signing secret for the KYC flow
- `NINJA_KYB_WEBHOOK_SECRET` — signing secret for the KYB flow
- `NINJA_ENV=sandbox`

The hosted-link integration does not need the Ninja public key or browser SDK. Never expose the Ninja secret key to a browser.

Ninja sandbox is free for sandbox flow tests; live registry checks are billed and live API keys require Ninja business/KYB approval. Keep production verification disabled until owner approval and live credentials are configured.

## 4. Backend API contract to implement

Create a staging-only Supabase Edge Function named `ninja-verification` with `verify_jwt=false` only because it must accept provider webhooks. Inside the handler:

### Authenticated seller action: `{ action: "start", store_id, check_type }`
1. Validate the Supabase bearer token with `auth.getUser`; reject missing/invalid sessions.
2. Confirm the authenticated user owns `store_id`. Never trust a client-supplied owner, plan, price, status or verification outcome.
3. Read the current plan entitlements and regional rules from the database. Permit commercial checks only when the selected plan requires/includes verification; permit mandatory compliance checks only when the current regional rule requires them.
4. Accept only explicit supported check types. Map individual identity/face checks to the configured KYC flow and CAC/business-registration checks to the KYB flow. Do not map phone OTP to Ninja.
5. Build a stable `customer_ref` containing the store id and logical check group. Create the one-time hosted link server-side, using the correct Sandbox API base URL and the Ninja secret key. Return only the link URL and non-sensitive status to the seller.
6. Persist provider = `ninja`, pending state and provider reference in the existing private-owned verification record. Repeated start requests must not create uncontrolled duplicate links; support a deliberate retry/resend path.
7. Rate-limit link creation and return a clear error if the flow or secret is not configured.

### Provider webhook
1. Read raw request bytes first. Verify `X-Ninja-Signature` as HMAC-SHA256 over the raw body with the correct flow-specific webhook secret. Compare in constant time. Reject invalid signatures with 401.
2. Validate event type, configured flow id, expected sandbox/live environment and required identifiers.
3. Deduplicate on stable `event_id` before applying business effects.
4. Resolve `customer_ref` to the exact store/check group; require a matching pending Ninja check. Never accept arbitrary store ids or check types from an unsigned payload.
5. Map `verified` to `verified`, `review` to `review`, and mismatch/not_found/underage/face_mismatch/liveness_failed/inactive/failed to `needs_attention` with a short safe reason.
6. Update all checks represented by the configured flow atomically, record event id and timestamps, and leave activation to the existing `request_store_activation` database function. A webhook must never set a store live directly.
7. Acknowledge valid events quickly with 2xx. Persist processing errors and allow safe retry/reconciliation.

### Important mapping
- KYC identity and face/liveness may be one hosted flow. If that flow verifies both, update the corresponding configured checks from the same verified event.
- KYB verifies CAC/company status. Do not mark business-address proof verified unless the configured KYB flow actually required and passed that proof.
- Keep phone verification separate.
- Treat `review` as a review queue state; do not silently convert it to verified.

## 5. Claude frontend tasks

1. Keep the existing onboarding and plan-carousel design. Do not redesign the seller journey again.
2. In `seller-flow.js`, replace the “provider not connected” placeholder only after the backend function is deployed and configured. Add a clear Start/Continue verification action that calls `ninja-verification` with `store_id` and the permitted `check_type`, then opens the returned hosted URL.
3. On return to Everneed, refresh status from the database. Never trust `?status=verified` or the Ninja redirect query string.
4. Show `pending`, `review`, `verified`, and `needs_attention` distinctly. Provide a safe retry action only when backend says retry is allowed.
5. Show CAC verification only for incorporated sellers / when the plan and regional policy require it. Do not ask sellers to type NIN/BVN into an Everneed form if Ninja's hosted flow collects it.
6. Preserve mobile-first accessibility and the existing 360–412 px design constraints.

## 6. Paystack completion tasks

1. Preserve the existing Inline JS v2 SDK in `js/cards.js`; do not add a second SDK.
2. Audit and test the complete shopper order flow: create order -> initialize immutable attempt -> open Paystack popup -> callback -> server-side verify -> webhook duplicate/retry -> exactly-once settlement -> order status and seller ledger.
3. Fix any SDK callback race: popup success must call backend verify; if webhook arrives first or later, both paths must be idempotent and converge on the same settled attempt.
4. Confirm the staging webhook URL in Paystack dashboard points to `https://vjiadqygpyebpisxslbx.supabase.co/functions/v1/paystack`; test valid signature, invalid signature, duplicate event, wrong amount/currency/reference, and late event.
5. Complete seller subscription billing separately: plan selection is not payment. Add server-side subscription transaction initialization/verification/webhook handling tied to a pending plan change and a durable `store_payments` record. Only after a verified successful transaction may the subscription/entitlement change. Preserve Free and existing paid plan prices; do not charge a seller just for choosing a plan.
6. Do not enable Paystack transfers/payouts or mark seller withdrawals paid as part of checkout. Payouts require a separate reviewed flow.
7. Ensure bank transfer and WhatsApp paths are not falsely labelled Paystack-paid. Keep manual payment reporting separate.

## 7. Acceptance test before external user testing

### Ninja sandbox
- Seller can start KYC and CAC hosted checks from the correct plan screens.
- Test KYC success, review, mismatch/not_found and liveness failure.
- Test KYB success, review/watchlist and CAC mismatch/inactive outcomes.
- Invalid webhook signature is rejected; duplicate event has one effect.
- Seller cannot start a check for another seller's store.
- No client can write a verified state or set a store live.
- Free/Starter sellers remain unblocked by optional commercial verification; Growth/Pro activation waits for required checks.

### Paystack test mode
- Test successful popup, cancellation, decline, delayed callback, webhook-before-callback and callback-before-webhook.
- Test repeated clicks and network retry with same idempotency key.
- Test wrong user, reference, amount and currency; none may settle.
- Test duplicate successful transaction/reference and ensure no second ledger credit.
- Test subscription payment success/failure and confirm plan/entitlements change only after verified success.
- Reconcile Paystack dashboard test transactions against Everneed payment attempts, orders, store payments and ledger entries.

### Release gate
- All GitHub checks pass, including Android build.
- Claude's real-device visual check and owner-run new-account click-through pass.
- Staging database and Edge Function tests pass.
- PR #31 remains open until the owner explicitly approves the final production promotion.
