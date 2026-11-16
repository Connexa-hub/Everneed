# Everneed Seller Tiers, Progressive Verification & Wallet Specification

**Status:** Product direction approved by owner; implementation not started  
**Date:** 16 November 2026  
**Branch:** web-portal  
**Environment:** Staging only  
**Related:** docs/WORKFLOW/WEBSITE_TRACKER.md, docs/WORKFLOW/DB_CONTRACT.md, docs/PRODUCT/FAST_SELLER_SETTLEMENT_SPEC.md

## 1. Owner-approved product direction

Everneed seller registration should have a low-friction Free entry tier. A person should be able to create an account, enter a polished seller workspace, create a store profile and begin preparing their catalogue without completing extensive commercial verification first.

Verification must be progressive and tied to the activity, risk, legal requirement or provider capability that actually requires it. Do not make full commercial verification a blanket prerequisite to account creation or basic dashboard access.

The seller dashboard must be a premium, genuinely useful workspace at every tier. Paid tiers add capacity and advanced capabilities; the Free dashboard must not be deliberately degraded.

Every seller should have an Everneed wallet. The wallet is an internal, auditable balance and transaction history. A unique virtual account should be provisioned for the seller through an approved payment-provider workflow and linked to that wallet. It is not a manually entered bank account number. The external bank destination for withdrawals is a separate payout instrument.

## 2. Existing verified baseline — do not assume these features already exist

Read-only inspection of Everneed-staging (vjiadqygpyebpisxslbx) on 16 November 2026 found:

- store_plans, store_subscriptions, store_payments, store_applications, stores and store_private already exist.
- Configured paid plans are:
  - Starter: ₦3,000/month, 25 products, standard commission.
  - Growth: ₦8,000/month, 200 products, 2 percentage-point commission discount.
  - Pro: ₦20,000/month, unlimited products, 4 percentage-point commission discount.
- No Free row was returned from the current store_plans configuration. The Free tier must be introduced deliberately and consistently; do not invent its product cap or daily listing cap. Keep the cap configurable and flag any unresolved limit for owner decision.
- Existing plan migration 011_plans_and_limits.sql enforces product_limit through a product trigger.
- Existing migration 019_regional_policy_and_store_verification_gate.sql currently sets Nigerian seller verification checks for phone, identity, face/liveness and business address as required, and private.store_live() requires verification completion for a public live store.
- Existing public.submit_store() requires business name, bank name, account number and account name before submission.
- Existing store_applications.account_number is an ordinary external bank account field, not an Everneed virtual account.
- Existing finance foundation includes private finance accounts, journals and journal lines (migrations 030–033). It is not a seller wallet product or virtual-account provisioning implementation.
- No dedicated seller wallet or virtual-account table was found in the staging schema query.
- Existing Paystack collection integration does not by itself prove that seller-specific virtual account provisioning, seller wallet funding, subscriptions by wallet debit or seller transfers are implemented or provider-approved.

These facts are a baseline, not permission to change production.

## 3. Seller tiers

Keep plan data configurable in the database. Avoid scattering tier names, product caps, prices and feature gates through frontend conditionals.

### Free — Entry tier

- No subscription fee.
- Simple registration and seller dashboard access.
- Create a store profile and prepare products.
- Basic store and catalogue management.
- Basic order workspace when the seller is eligible to receive orders.
- Everneed wallet overview and transaction history.
- No extensive commercial verification merely to create the seller account or access the basic workspace.
- No mandatory manually entered bank account number as an account identifier.
- Exact product limit and any daily listing limit remain owner-configurable decisions; do not invent values or hardcode the previous erroneous 15-product / 5-listings-per-day suggestion.

### Starter — ₦3,000/month

- Existing configured limit: 25 products.
- Standard commission.
- Core seller dashboard and earnings.
- Hub or direct delivery.

### Growth — ₦8,000/month

- Existing configured limit: 200 products.
- Existing configured 2 percentage-point commission discount.
- More advanced analytics and inventory/management capabilities.

### Pro — ₦20,000/month

- Existing configured unlimited product limit.
- Existing configured 4 percentage-point commission discount.
- Premium analytics, reporting and operational tools.

Do not silently change existing prices or product limits. Verify all plan features against the current app and owner decisions before editing plan seed data.

## 4. Progressive verification and eligibility model

Separate these concepts in the product and backend:

1. Account registration: a user can create an account and enter the seller workspace.
2. Store setup: the seller can create a draft store, add profile information and prepare catalogue content.
3. Marketplace activation: the seller can perform the activities that expose products to shoppers and accept paid orders, subject to applicable policy, safety and legal requirements.
4. Financial services eligibility: virtual-account provisioning, wallet funding, holding funds and withdrawals may have separate payment-provider, identity, AML/KYC and legal requirements.

Do not use one all-or-nothing verification_complete flag to control all four stages.

Create explicit, understandable capability gates. The UI must say what is blocked, why, and what the seller needs to do next. A higher paid tier must never bypass a legal, provider or risk requirement.

The current Nigeria verification defaults in migration 019 are stricter than the owner's desired low-friction entry experience. Audit every dependency on:
- seller_verification_rules
- store_verification_checks
- private.store_verification_complete()
- private.store_live()
- stores.activation_status
- public.submit_store()
- product publication/review guards
- order acceptance and payment eligibility

Propose the smallest safe staging-only change that removes unnecessary checks from account creation and basic workspace access while preserving checks that are legally or provider-required before a particular transaction or public marketplace activity. Do not simply disable all Nigerian checks or set all stores live.

Where legal/provider requirements are not yet established, leave that capability gated and document the exact requirement. The owner wants easy entry, not unlawful or provider-ineligible handling of customer funds.

## 5. Seller wallet and virtual account

### Wallet

Each seller/store should have a wallet account in the relevant currency, with a secure internal ledger view and immutable transaction history.

The wallet UI should distinguish:
- Available balance.
- Pending marketplace earnings.
- Held amounts and clear hold reasons.
- Wallet funding transactions.
- Subscription debits.
- Withdrawal requests and outcomes.
- Reversals and adjustments.

The wallet must not be a mutable client-side balance. It must derive from server-authorised, auditable postings and the existing finance journal foundation.

### Virtual account

Provision a unique provider-backed virtual account for the seller where the provider and applicable compliance model permit it. Persist provider, account identifier/number, account name, currency, status, creation reference and safe metadata in a private server-controlled model.

The virtual account is used to identify incoming seller funds and route/attribute those funds to the correct Everneed wallet. It is not the seller's withdrawal destination and must never be a free-text account-number field.

Never show a seller a fabricated account number. UI states must include not requested, provisioning, active, failed/needs attention and unavailable/eligibility required.

### External withdrawal destination

Collect the seller's external bank payout destination separately, only when required for withdrawals and through a secure, verified workflow. Do not conflate it with the Everneed virtual account.

### Provider feasibility gate

Before implementation, inspect the live staging Paystack integration and establish:
- Whether the Everneed merchant/legal account is eligible to create dedicated virtual accounts for individual sellers.
- Whether Paystack's product supports the proposed marketplace/collection model and seller-level attribution.
- What identity/business verification is required before provisioning.
- Which currencies and countries are supported.
- How incoming credits, reversals, fees and reconciliation are represented.
- Whether the same funds may lawfully be held and subsequently paid out under the intended Everneed legal model.

If Paystack does not support the required seller-linked model under Everneed's current account, document alternatives and their implications. Do not claim that a virtual account exists or that a wallet has been funded until provider evidence is verified.

## 6. Subscription and wallet payment

Sellers should be able to subscribe inside Everneed.

- Display the selected tier, price, billing period and renewal date.
- Permit wallet debit only when the available balance is sufficient.
- Perform debit and subscription activation atomically and idempotently on the server.
- If the wallet is insufficient, offer supported wallet funding or another verified payment method.
- Record immutable subscription payment references.
- Handle pending, failed, reversed and duplicate provider events.
- Never activate a paid plan solely because the client says payment succeeded.
- Do not allow a paid plan to bypass verification or compliance gates.

The existing choose_plan() and store_payments flows must be inspected before adding new subscription paths.

## 7. Marketplace earnings and withdrawals

Marketplace earnings follow the existing order/payment/delivery/refund/dispute contracts.

- Customer payment must be provider-verified.
- Seller earnings are pending until the approved delivery and settlement eligibility conditions are satisfied.
- Active refunds, returns or disputes should hold only the affected seller package/amount where allocation is reliable.
- Consolidated hub delivery remains parent-order-level under the current schema. Do not invent independent seller-package dispatch/delivery events.
- Wallet credit and withdrawal eligibility must be separate states.
- Withdrawals must be server-side, idempotent and provider-confirmed.
- Unknown provider outcomes require reconciliation, not blind retry.
- No live transfers until written provider approval and legal/accounting sign-off.

## 8. Seller dashboard UX

Design a distinctive, premium Everneed seller workspace inspired by Shopify's commerce clarity and Cash App's financial clarity, without copying either.

The Free tier must be beautiful and practical. Paid tiers progressively unlock richer capabilities, not basic usability.

Core dashboard:
- Store identity and store switcher.
- Tier and usage meter.
- Wallet balance, pending earnings and available-to-withdraw amount.
- Sales/order activity.
- Product/catalogue overview and inventory warnings.
- Store performance and actionable insights.
- Notifications/messages.
- Subscription management and upgrade path.
- Verification/eligibility status with clear next steps.

Tier progression:
- Free: clean core workspace and essential selling tools.
- Starter: improved catalogue/inventory and basic reporting.
- Growth: advanced analytics, performance insights and promotion tools.
- Pro: advanced reporting, bulk operations and premium management tools.

Design constraints:
- Mobile-first, 360–412px and low/mid-range Android.
- Fast, lightweight assets and scripts.
- Clear contrast, readable type and touch targets >=44px.
- No dead buttons, fake data, fake balances or false success messages.
- Avoid decorative circular controls, heavy blur and unnecessary animation.
- Every action must connect to a real backend capability or be clearly disabled with an explanation.

## 9. Admin and operations

Provide authorised admin visibility into:
- Tier and subscription state.
- Store activation and verification capabilities.
- Virtual-account provisioning state.
- Wallet transaction and reconciliation exceptions.
- Pending/failed/reversed withdrawals.
- Provider references and audit trail.

Sensitive identity and bank data must remain private and masked. Admin actions require server-side authorisation, reasons and immutable audit records.

## 10. Implementation sequence

1. Inspect current seller frontend, plan selection, onboarding, verification gates, Paystack Edge Function and finance schema.
2. Produce a concise gap report and exact dependency map before editing schema.
3. Fix the Free tier and dashboard entry experience without weakening legally required financial controls.
4. Separate account/store setup eligibility from public marketplace activation and financial-service eligibility.
5. Design the wallet/virtual-account model against confirmed provider capabilities.
6. Implement staging migrations, trusted RPCs and Edge Function paths only after the provider feasibility check.
7. Connect subscriptions, incoming credits, seller earnings and withdrawals to immutable journal postings.
8. Build seller and admin UI against actual contracts.
9. Run CI, database/security tests and full staging end-to-end flows.

## 11. Definition of done

- A new Free seller can register and access a polished dashboard without unnecessary commercial verification.
- Store setup and draft product preparation work.
- Public selling and financial activities enforce only their applicable, documented eligibility requirements.
- Free plan limits are configurable and explicitly approved; no invented cap is silently shipped.
- Starter/Growth/Pro match the current configured values unless the owner explicitly changes them.
- The seller sees a wallet and accurate virtual-account provisioning state.
- No manually entered ordinary bank account is presented as the Everneed virtual account.
- Provider-confirmed incoming funds reconcile to the correct seller wallet.
- Subscription debits and withdrawals are secure, atomic and idempotent.
- Seller data is isolated under RLS and trusted RPC boundaries.
- No fake provider account, payment, balance or transfer state is shown.
- All work and tests remain on staging; production is untouched until explicit release approval.
