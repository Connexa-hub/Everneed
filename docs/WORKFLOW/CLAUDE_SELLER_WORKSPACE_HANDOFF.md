# Claude Task — Seller Free Entry, Tier-Aware Dashboard and Wallet UX

**Priority:** P0 seller website MVP  
**Branch:** web-portal  
**Environment:** staging only  
**Owner:** Claude — frontend and existing web flow integration  
**Coordinator:** ChatGPT — backend contracts, migrations, security and staging verification  
**Read first:** docs/PRODUCT/SELLER_TIERS_WALLET_SPEC.md, docs/WORKFLOW/SELLER_ENTITLEMENTS_AND_VERIFICATION_CONTRACT.md, docs/WORKFLOW/DB_CONTRACT.md, docs/WORKFLOW/WEBSITE_TRACKER.md

## Owner direction

The seller must not face extensive commercial verification just to create an account and enter a basic seller dashboard. The Free tier must be a real, beautiful, usable tier. Paid tiers progressively add capacity and advanced tools. Every seller should have an Everneed wallet and, where provider eligibility allows, a provider-linked virtual account. The virtual account is not an ordinary bank payout account.

## Verified current implementation findings

Inspected current web-portal source on 16 November 2026:

1. web/assets/js/setup.js is a five-step setup flow. Step 4 is currently explicitly a bank payout step. It requires bank name, ordinary account number and account name, validates the account number, saves those fields to store_applications, and shows the last four digits in the final review.
2. public.submit_store(p_store) in migration 019 rejects submission unless business_name, bank_name, account_number and account_name are all present. The current setup and database contract therefore force bank payout details before an application can be submitted.
3. web/assets/js/workspace.js currently loads store, products, product-private notes, collections, size charts, store-private details, application and notifications. It does not load wallet, virtual-account, plan-entitlement, usage or subscription data.
4. The existing dashboard is mostly a product onboarding guide and four product-status KPIs. It has no real wallet summary, available/pending earnings, subscription usage meter or tier-aware feature surface.
5. Workspace route logic only renders the full dashboard when the store is approved and activation_status is live; other states fall back to the portal shell/onboarding flow. Preserve and clearly present pending/rejected/suspended/not-live states rather than showing a false Live dashboard.
6. Existing docs/WORKFLOW/SELLER_ENTITLEMENTS_AND_VERIFICATION_CONTRACT.md already defines the tier verification policy:
   - Free and Starter: commercial verification optional; activation must not be blocked solely because of optional commercial verification.
   - Growth and Pro: verification included and required for activation, subject to successful checks.
   - Mandatory regional/legal/category/payment checks remain independent and override plan entitlements.
   - No Free plan row currently exists. Its active-product and daily new-listing limits remain deliberately unresolved; do not invent either.
   - Existing paid tiers are Starter ₦3,000 / 25 products, Growth ₦8,000 / 200 products, Pro ₦20,000 / unlimited.
7. Migration 019 currently makes four Nigeria checks required (phone, identity, face/liveness, business address). private.store_live() requires all enabled required checks, without considering the seller's plan. request_store_activation() also treats every required check as mandatory. This is a backend contract issue; do not bypass it with frontend-only status changes.
8. Existing public.submit_store() also enforces seller-policy acceptance. Preserve that requirement. Remove only the unnecessary early bank-payout prerequisite after coordinating the backend contract.
9. Staging schema inspection found no dedicated seller wallet or seller virtual-account table. Existing finance journal migrations 030–033 are an accounting foundation, not an implemented seller wallet or virtual-account product.
10. The current Paystack Edge Function implements shopper payment collection/verification. Do not assume seller virtual-account provisioning, wallet funding or transfer APIs are already integrated.

## Frontend implementation — do now

### A. Seller entry and setup
- Keep sign-up and seller entry low-friction.
- Let a seller create/resume their store draft, choose store identity/categories/location and save profile details without providing an ordinary bank account number.
- Remove the payout/bank step from the initial store-creation journey.
- Replace it with a useful next step such as “Your Everneed wallet” / “Set up payouts later”, showing accurate status and explaining that payout setup is needed only when the seller is eligible to withdraw.
- Do not label the wallet virtual account as an external payout destination.
- Keep required seller-policy acceptance and existing business-name/application rules unless the coordinator supplies a revised tested backend contract.
- Do not simulate OTP, identity, liveness or provider verification.

### B. Tier-aware seller dashboard
- Build a polished responsive dashboard for Free, Starter, Growth and Pro.
- Free must look professional and remain genuinely usable.
- Use the actual effective plan/entitlement data returned by backend; do not infer tier from a null subscription plan or hardcode product limits.
- Show store status separately from application decision, verification, subscription and compliance.
- Show catalogue usage only when the backend returns an authoritative limit.
- Paid tiers can expose progressively richer analytics, inventory controls, promotions, reports and bulk actions. Locked modules need honest explanations and upgrade paths, not fake buttons.
- Keep existing product editor/list features intact.
- Add wallet panels only when real wallet data/API is available. Until then show a clear “Wallet setup in progress / not yet available” state; never show a fabricated balance or account number.
- Use existing design tokens and CSS architecture. No circular decorative controls, heavy blur, dead clicks or oversized mobile layouts.

### C. Routes and state handling
- Make the seller workspace usable for draft, pending, approved-not-live, live, rejected, changes-requested and suspended stores.
- Do not send an existing seller back to new-store registration.
- Ensure every visible action routes to a real flow.
- Provide loading, empty, error, retry and success states.
- Mobile-first for 360–412px, low/mid-range Android and constrained data; minimum 44px touch targets.

## Backend coordination — migration 034 applied to staging (16 Nov 2026)

Migration file: `supabase/migrations/20261116201132_seller_onboarding_entitlements_and_quotas.sql`
Staging project: `vjiadqygpyebpisxslbx`. Remote migration ledger confirms version `20261116201132` applied. Production remains untouched.

Claude can now integrate these real backend contracts:
- `public.submit_store(p_store text)`: seller submission requires business_name and latest seller policy acceptance; bank_name/account_number/account_name are no longer prerequisites. Keep payout destination setup separate and later.
- `public.my_store_entitlements()`: returns the authenticated seller's effective plan, active product usage/cap, daily listing usage/cap, verification entitlement and business timezone. Treat `configured=false` as a real not-configured state.
- Admin reads `public.seller_plan_entitlements` under admin-only RLS.
- Admin writes limits through `public.admin_set_plan_entitlements(plan_id, active_limit, active_unlimited, daily_limit, daily_unlimited, verification_included, reason)`. Both limits require either a positive integer or an explicit unlimited flag. The RPC audits before/after values and actor.
- Admin classifies regional verification rules through `public.admin_set_verification_scope(country, check_type, scope, reason)`, where scope is `mandatory_compliance`, `commercial`, or `unclassified`.

Important safety state:
- Free plan shell `plan-free` exists but is inactive and both limits are unset. It becomes selectable only after an admin configures both limits.
- Starter remains 25 active products; Growth 200; Pro unlimited. Existing prices are unchanged. Existing paid-tier daily quotas are explicitly unlimited.
- All four existing Nigeria checks remain `unclassified`. Unclassified required checks continue to block activation. Do not tell sellers these are optional or bypass them until an authorised admin classifies them. This deliberately fails closed rather than guessing which checks are legally mandatory.
- Growth/Pro entitlements require commercial verification; Free/Starter do not, once rule classifications and mandatory compliance are configured.
- Product insert and archive restore are guarded in the database. New-product daily quota events are durable and cannot be reset by deleting a product.
- This migration does not implement a wallet, virtual account or payout provider workflow.

Do not remove the bank step until your frontend is wired to the updated staging RPC. Keep the seller setup page responsive and show payout setup as a later, clearly separate task. Do not fake any wallet data.

## Required deliverables

1. Implement the low-friction seller setup UI with payout details deferred, coordinated with the updated backend submission contract.
2. Implement the tier-aware seller dashboard shell and state labels using real backend data.
3. Preserve current product CRUD/editor and existing order functionality.
4. Add no fake wallet, virtual-account or transfer states.
5. Update docs/WORKFLOW/WEBSITE_TRACKER.md with actual statuses and changed files.
6. Commit small changes to web-portal; do not merge PR #31.
7. Report exact routes tested, CI results, remaining backend blockers and owner phone-test requirements.

## Acceptance criteria

- New seller can sign up, enter seller setup and save/resume a store draft without entering a bank account number.
- Seller can submit the application after satisfying actual required business and seller-policy requirements, without a payout bank field being mandatory.
- Free/Starter optional commercial verification is not presented as mandatory; Growth/Pro included verification is clearly explained.
- Mandatory legal/regional checks remain enforced.
- Seller sees accurate store/application/verification/subscription states.
- Dashboard is excellent on mobile and desktop and all controls work.
- No false wallet balance, virtual-account number, payout success or tier entitlement.
- Staging only; production remains untouched.


## Admin configuration requirement — owner decision (16 November 2026)

The Free-tier active-product cap and daily new-listing cap must be configurable by an authorised platform admin in the admin workspace. Do not hardcode either value or invent defaults.

Frontend/admin work:
- Add an admin settings surface for the two Free-tier limits, only if the existing admin architecture has a real authorised route and backend contract.
- Display unset values as “Not configured”, not zero and not unlimited.
- Provide clear validation, save/error/success states, and explain that changes affect server-enforced seller entitlements.
- Do not expose these controls to sellers or ordinary admins without the required permission.

Backend coordination:
- The coordinator must supply a server-authorised read/write contract, validation rules, audit logging and server-side enforcement before connecting the UI.
- Product creation/publication and daily listing quota checks must use the same effective configuration returned to the seller dashboard.
- Until the setting is configured, the UI must not claim a numeric cap or unlimited capacity. Do not block seller account creation or basic dashboard access because the setting is unset.


## Staging backend update — 16 November 2026

The backend migration is now applied to Everneed-staging. Use the contracts above; do not wait for a future migration to remove the initial payout-bank prerequisite. Keep the Free plan UI as “Not configured” until the platform admin configures both limits. Build the authorised admin settings surface against the existing RPCs and admin-only table read policy. Add verification-scope classification to the admin operations UI, but do not preselect classifications for Nigeria's four existing checks.

## Quota-trigger security correction — 16 November 2026

A follow-up staging migration `20261116201843_seller_product_quota_trigger_privilege_fix` makes the product guard SECURITY DEFINER with explicit caller-role checks. This is required because ordinary seller RLS could not read the private entitlement rows or insert durable quota events under an invoker trigger. The trigger still bypasses trusted service-role/admin operations and enforces seller quotas. A staging transaction test impersonating the Shopflow seller inserted one draft product under a one-per-day test entitlement, verified the second insert was rejected with the daily-limit error, and rolled the transaction back. No persistent test product or plan change remains.

The CI regression test now asserts the trigger is SECURITY DEFINER. The full local migration replay/database CI is the next validation gate.