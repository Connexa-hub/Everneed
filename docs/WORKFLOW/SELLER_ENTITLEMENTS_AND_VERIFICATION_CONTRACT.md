# Seller Verification, Subscription Entitlements & Store Activation Contract

**Status:** Architecture contract for Claude (frontend) and ChatGPT (backend)  
**Branch:** `web-portal`  
**Date:** 2026-11-15  
**Scope:** Staging-first. This document does not authorize production changes or a database migration.

## 1. Purpose

Resolve the current contradiction where the admin portal labels an approved seller store as **Live**, while the seller portal says **Verification needed to go live**.

Application approval, operational activation, verification, and subscription status are separate concepts. Approval must never be presented as proof that a store is live. Verification must not be a universal commercial gate: eligible lower tiers can sell with limited entitlements, while higher tiers can include verification or sellers can buy it as an add-on. Mandatory legal, safety, identity, tax, or payment-provider checks for a country or product category always override the commercial plan.

## 2. Required state model

Do not overload `stores.status` or `activation_status` to represent several different concepts.

| Concern | Meaning | Suggested states |
|---|---|---|
| Application decision | Has Everneed reviewed the seller's application? | draft, pending, approved, rejected, changes_requested |
| Store operation | Can shoppers browse and buy from this store? | not_live, live, suspended, closed |
| Verification | What is the seller's verification state? | not_required, not_started, pending, verified, failed, expired, action_required |
| Subscription | What paid/free plan is currently effective? | trialing, active, past_due, paused, cancelled, expired |
| Compliance | Are mandatory country/category checks satisfied? | compliant, pending, blocked, expired |

If the existing schema cannot support these dimensions cleanly, add a backwards-compatible migration rather than silently changing the meaning of existing columns. Keep a documented mapping during transition.

## 3. Verification policy by tier

Verification is an entitlement/policy, not a universal consequence of application approval.

| Tier | Commercial verification policy | Selling entitlement |
|---|---|---|
| Free | Not included by default; verification is optional and purchasable separately | Can go live without commercial verification, subject to mandatory regional/legal checks and Free limits |
| Starter | Verification optional as a paid add-on | Can go live without commercial verification, subject to mandatory regional/legal checks and Starter limits |
| Growth | Seller verification included in the plan (subject to successful checks) | Can go live after included verification and mandatory regional/legal checks pass |
| Pro | Seller verification included in the plan (subject to successful checks) | Can go live after included verification and mandatory regional/legal checks pass |

The plan policy must be data-driven and admin-configurable, not hard-coded in JavaScript or scattered SQL conditionals. Suggested entitlement keys:

- `verification.included` (boolean)
- `verification.required_to_activate` (boolean, commercial rule only)
- `verification.addon_available` (boolean)
- `catalog.active_product_limit` (integer or unlimited)
- `catalog.new_products_per_day` (integer or unlimited)
- `catalog.categories` / category restrictions where needed
- `analytics.level`, `promotions.enabled`, `inventory.level`, `support.level`
- `commission.rate` or commission discount/override, using existing approved pricing rules

Country and product-category compliance rules are evaluated independently and take precedence over plan entitlements. A Free seller cannot bypass a legally mandatory check by choosing a lower tier.

### Limits and pricing

Existing configured plans must be preserved until an explicit pricing decision:
- Starter: currently 25 products.
- Growth: currently 200 products.
- Pro: currently unlimited products.

There is currently no Free plan in `store_plans`. Add Free as a configurable plan only after the initial Free active-product limit and daily new-listing limit are approved. Do not invent a price or hard-code provisional numbers. Admin must be able to configure both limits per region/plan. Daily listing limits should count successful product creation in the relevant store-local/business timezone and should not be bypassable by deleting and recreating products.

## 4. Activation decision

The backend activation decision must evaluate the following in order:

1. Authenticated user owns the store, or caller has an authorized admin override.
2. Application is approved.
3. Store is not suspended, closed, or otherwise administratively blocked.
4. Effective subscription is valid and has a plan/entitlement set (including an explicitly configured Free plan).
5. All mandatory regional, product-category, and payment/compliance requirements are satisfied.
6. If the plan's commercial entitlement says verification is required, the required seller checks are verified; otherwise commercial verification is not a blocker.
7. Set the store's operational state to `live` and record actor, timestamp, policy/entitlement snapshot, and reason.

If activation is denied, return a structured result with reason codes, e.g. `APPLICATION_NOT_APPROVED`, `SUBSCRIPTION_INACTIVE`, `MANDATORY_COMPLIANCE_MISSING`, `PLAN_VERIFICATION_REQUIRED`, `STORE_SUSPENDED`. Do not return a generic “verification required” message for every failure.

The existing `request_store_activation(p_store)` currently checks all enabled required seller-verification rules without considering the store's plan. Refactor it to distinguish **mandatory compliance checks** from **commercial plan verification**. Preserve throttling, ownership checks, and admin safeguards.

## 5. Approval and admin UI semantics

- Approving an application means **Approved**, not **Live**.
- Admin seller list/detail must show separate badges/fields for Application, Store status, Verification, Subscription, and Compliance.
- The admin interface must not infer `Live` from `stores.status = approved`.
- A newly approved store may be `not_live` while activation prerequisites are being met.
- Admin may override activation only through a privileged, audited action with a mandatory reason. An override must not bypass mandatory legal/compliance checks.
- Notifications must state the actual next action: choose/activate a plan, complete included verification, complete mandatory regional checks, or request optional verification.

## 6. Seller portal UX contract for Claude

Claude owns all seller/admin visual implementation. Build one coherent portal system with tier-aware modules and presentation, not separate duplicated applications.

### Seller portal
- Show a clear store status: Application pending / Approved – not live / Live / Suspended.
- Show verification independently: Not required / Optional / Included – action needed / In review / Verified / Failed / Expired.
- For Free and Starter, do not block activation solely because optional commercial verification is incomplete.
- Offer an optional “Get verified” purchase path where the add-on is available.
- For Growth and Pro, show verification as included and explain the required steps before activation.
- Display a plan comparison/upgrade surface with exact entitlements and limits returned by the backend.
- Display product usage (active products and daily listing quota) and explain limits before a seller hits them.
- Gate premium modules from backend entitlements; do not rely on hiding buttons alone.
- Use upgrade previews and clear locked-feature explanations without deceptive or coercive prompts.
- Design mobile-first for low/mid-range Android devices and constrained data: fast initial render, lightweight assets, clear contrast, large touch targets, no unnecessary heavy blur/animation.

### Admin portal
Build an operations command centre with role-appropriate access and audit trails:
- Overview: GMV, net revenue, orders, active sellers, growth, alerts and operational exceptions.
- Seller operations: applications, verification queue, subscriptions, entitlement overrides, suspensions and risk flags.
- Commerce: products/catalog moderation, orders, returns, disputes and refunds.
- Finance: double-entry ledger, commissions, Paystack transactions, seller balances, payouts and reconciliation.
- Logistics: hub intake, parcel custody, consolidation, dispatch and delivery proof.
- Subscriptions: plans, regional pricing, trials, renewals, upgrades/downgrades, add-ons and entitlement configuration.
- Customers and support.
- Platform configuration: regions, tax/compliance rules, commissions, FX, delivery fees, verification rules and feature controls.
- Security: role permissions, admin action history and immutable audit events.

Do not expose finance, identity, bank, or customer-private data beyond the caller's authorized role and purpose.

## 7. Backend contract and security requirements

- The database is the source of truth for effective entitlements.
- Provide a stable server-side function/API that returns the store's effective plan, entitlement values, usage counters, verification state, compliance blockers, and activation eligibility.
- Enforce product count and daily listing quotas in trusted database functions/triggers or server-side mutation paths, not only in the UI.
- Re-check entitlements at the moment of every protected mutation; never trust client-supplied plan IDs, limits, prices, verification flags, or store status.
- Add an auditable admin entitlement override with actor, reason, scope, expiry, and before/after values.
- Plan changes and add-on purchases must be represented by durable subscription/billing records. Do not mark verification as purchased or verified from a client-side callback.
- Verification provider results must be validated server-side and stored with timestamps, provider references, status, and an audit trail. Avoid storing unnecessary sensitive identity data.
- Bank-account/payout verification is a distinct payout-control requirement and must not be conflated with storefront seller verification.
- Preserve RLS and least-privilege access. SECURITY DEFINER functions must pin a safe search_path and perform explicit authorization checks.

## 8. Migration and implementation sequence

1. Inspect current schema, triggers, RLS, plan rows, verification rules, and all callers of `approve_store`, `request_store_activation`, and store status fields.
2. Write a compatibility map from current fields to the separated state model.
3. Add entitlement/configuration tables and any required state columns using a backwards-compatible staging migration. Do not rewrite production.
4. Seed existing Starter/Growth/Pro entitlements from the current plan rows; do not change their prices or product limits.
5. Add a configurable Free plan only after the two Free catalog limits are approved.
6. Refactor activation RPC to apply plan-specific commercial verification and independent mandatory compliance.
7. Add server-side entitlement read and enforcement functions for product creation/activation and premium features.
8. Update admin/seller UI to consume the backend contract and show each state independently.
9. Add tests for every tier, optional verification, mandatory compliance, plan expiry, suspension, admin override, daily quota, and ownership/RLS.
10. Deploy to staging, seed test stores, run regression/security tests, and verify UI end-to-end. Production remains untouched until staging passes and the user explicitly authorizes promotion.

## 9. Minimum acceptance tests

- Approved + Free + no mandatory regional checks + no optional verification: activation succeeds within Free limits.
- Approved + Starter + no optional verification: activation succeeds within Starter limits.
- Approved + Growth/Pro + required verification incomplete: activation is denied with `PLAN_VERIFICATION_REQUIRED`.
- Approved + any tier + mandatory regional check incomplete: activation is denied with `MANDATORY_COMPLIANCE_MISSING`.
- Pending/rejected application cannot activate.
- Suspended store cannot activate, including via ordinary seller RPC.
- Admin override is audited and cannot bypass mandatory compliance.
- Product creation above active-product cap is rejected server-side.
- Daily listing quota is enforced server-side and cannot be reset by deleting products.
- Expired/cancelled subscription falls back only to a deliberately configured grace/downgrade policy; it must not silently gain unlimited entitlements.
- Admin UI never labels an approved-but-not-live store as Live.
- Seller UI and backend return the same effective plan, verification requirement, blockers, and usage.

## 10. Ownership and coordination

**Claude (frontend):** seller portal tier-aware UX, admin command-centre UX, responsive/mobile implementation, state labels, plan/verification surfaces, and frontend integration with the backend contract.

**ChatGPT (backend):** schema and migration design, entitlement resolution, activation RPC, RLS/security, quota enforcement, subscription/add-on billing contracts, audit trail, staging tests, and production-safety review.

**Shared rule:** Do not change production or merge/deploy a migration until staging tests pass and the user explicitly authorizes the production step.

## 11. Open configuration decision

Owner decision on 17 November 2026: Free/Entry and its free trial use seeded defaults of 5 active products and 2 new product listings per seller-local calendar day. These values are not dependent on prior admin configuration. Admins may change them through the existing audited entitlement RPC. Starter/Growth/Pro remain unchanged.


## 12. Verified staging findings (2026-11-15)

Read-only inspection of staging project `vjiadqygpyebpisxslbx` confirmed:

- Migrations currently end at `025 storefront_details_seller_grant`; migration `026` has not been applied.
- Nigeria currently has four enabled, required checks in `seller_verification_rules`: phone, identity, face_liveness, and business_address. The current activation RPC treats all four as mandatory for every store, irrespective of subscription plan.
- `approve_store` currently writes `stores.status='approved'` and `activation_status='verification_required'`, creates a trial subscription with `plan_id=NULL`, and sends a notification that verification must be completed. This explains the seller/admin mismatch.
- Admin UI must therefore show Application = Approved and Store = Not live / verification or plan prerequisites pending, not Live.
- Existing plans are Starter (NGN 3,000/month, 25 products), Growth (NGN 8,000/month, 200 products), and Pro (NGN 20,000/month, unlimited products). No Free plan currently exists. These prices and limits were observed, not changed.
- Shopflow and the official EverNeed store currently have subscriptions with `plan_id=NULL`; Shopflow is trialing and EverNeed's subscription is active. Do not silently infer either store's tier from a null plan ID.
- `private.products_guard()` already enforces the existing active-product limit on product insert and archive restore. It does not enforce a daily new-product quota. It currently derives limits directly from `store_plans.product_limit`.
- Product writes are guarded by a BEFORE INSERT/UPDATE trigger, so quota enforcement can be extended at the database boundary. New daily quota logic must use a durable usage/event record or equivalent concurrency-safe accounting; a simple client counter is insufficient.
- Existing `choose_plan(p_plan)` lets a store owner select an active plan during a trial, but it does not establish a Free tier or resolve null-plan entitlement behavior.

### Implementation implications

1. Add a first-class plan entitlement representation and seed the three existing paid plans without changing their prices or limits.
2. Keep null-plan subscriptions in a non-activatable/needs-plan state until the product owner chooses a Free plan or selects a paid plan. Do not treat null as unlimited or automatically map it to Starter.
3. Separate the current Nigeria verification rules into mandatory compliance versus commercial seller verification. The current four required flags must not automatically become mandatory legal checks merely because they are marked `required`; confirm their legal/business classification before moving them into the mandatory compliance gate.
4. Refactor the activation function only after the rule classification is represented explicitly in schema. Until then, do not bypass the current gate by manually setting stores live.
5. Preserve the existing product-limit trigger while moving its source of truth to effective entitlements; add a separate concurrency-safe daily listing quota.
6. The Free plan remains unseeded until its active-product and daily-listing caps are approved.


## 13. Free Entry defaults correction — 17 November 2026

- Free plan defaults: 5 active products and 2 new product listings per seller-local calendar day.
- The Free trial uses exactly the same entitlements; trial status does not grant paid-tier capacity.
- Admin configuration is optional policy management, not a prerequisite for Entry plan availability.
- Migration `20261116233544_free_entry_defaults_and_trial_assignment.sql` activates `plan-free`, seeds both bounded limits, and maps valid `trialing` subscriptions with a null plan to `plan-free`. Paid subscriptions and expired trials are not rewritten.
- This fixes the missing-plan / unconfigured-quota condition. It does not classify or bypass the four existing Nigerian verification rules; those remain a distinct activation blocker until each is assigned its correct scope.
