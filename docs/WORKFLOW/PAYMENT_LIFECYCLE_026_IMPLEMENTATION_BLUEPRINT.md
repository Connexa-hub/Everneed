# Payment Lifecycle 026 — Implementation Blueprint

**Status:** design/implementation blueprint only. This document does not apply a database migration or deploy an Edge Function.  
**Target branch:** `web-portal`  
**Next migration:** `026_payment_lifecycle.sql` (confirmed free on this branch)  
**Staging target:** `Everneed-staging` only, after review and explicit staging-apply authorization. Production is out of scope.

Related contract: [PAYMENT_LIFECYCLE_026_CONTRACT.md](./PAYMENT_LIFECYCLE_026_CONTRACT.md)

## 1. Reconciliation against the actual branch

The migration directory on `web-portal` contains the numbered sequence through:

- `016_public_rpc_security_hardening.sql`
- `017_authenticated_rpc_boundary_hardening.sql`
- `018_turnstile_public_rpc_boundary.sql`
- `019_regional_policy_and_store_verification_gate.sql`
- `020_regional_policy_rls_and_approval_hardening.sql`
- `021_policy_document_public_read_hardening.sql`
- `022_require_latest_seller_policy_acceptance.sql`
- `023_seed_managed_seller_categories.sql`
- `024_storefront_public_details.sql`
- `025_storefront_details_seller_grant.sql`

Migration 025 grants only column-level access to `stores.storefront_details`; it does not introduce payment schema. Migrations 016–022 reinforce the SECURITY DEFINER/RPC boundary and regional policy controls. They do not provide payment-attempt, webhook-inbox, or provider-refund lifecycle tables.

### Existing schema and behavior verified in source

- `orders.id`, `seller_orders.id`, `order_items.id`, and `refunds.id` are text UUID strings. User ownership uses `uuid`.
- Order money fields and ledger/refund amounts are numeric major currency units. Paystack requests use integer minor units.
- `orders` currently stores the current total/currency/payment status and mutable order data, but no complete immutable checkout quote/allocation snapshot.
- `create_order(...)` validates products and stock, calculates order rows, seller orders, commissions and delivery route. It currently does not persist the full FX source/time, markup, offer allocation and item-level refundable allocations.
- `private.confirm_payment_core(...)` locks the order but returns `already` whenever `payment_status='paid'`; it does not compare a second provider transaction with the original successful attempt.
- `private.cancel_so(...)` creates an `approved` legacy refund using a proportional formula, reverses seller ledger entries and sends a “refund is on its way” notification. It does not call Paystack.
- `public.refund(...)` inserts a legacy `processed` refund and adjusts the seller ledger without provider confirmation.
- `record_payout(...)` records a manually executed payout; it is not a provider transfer.
- The current Paystack Edge Function recalculates price/FX on initialization, retry and saved-card collection. It accepts a charge amount greater than the order amount, returns success early for already-paid orders, and has no durable webhook inbox.
- Existing legacy refund statuses are `requested`, `approved`, `processed`, and `rejected`. They must not be reinterpreted as Paystack submission/confirmation states.
- Existing orders created before 026 cannot safely receive fabricated quote snapshots. They must remain legacy/unreconciled and use a manual exception path where needed.

## 2. Design rules

1. Keep provider credentials, provider payloads, payment attempts and refund execution metadata in a non-client-writable private boundary.
2. Keep order and seller-order IDs as text; do not convert existing identifiers.
3. Store exact integer minor-unit amounts, currency and currency exponent on every provider attempt. Use an explicit currency-exponent map; do not assume every future currency has two decimals.
4. Freeze the checkout quote once, before payment initialization. Retries must reuse it, never reprice.
5. A retry is a new provider attempt with a new provider reference. A client idempotency key prevents duplicate creation from repeated taps/network retries.
6. Permit only one active attempt per order at a time. Serialize creation/settlement with row locks and/or transaction-scoped advisory locks.
7. A successful provider event is not sufficient by itself: validate provider, reference, order ownership/metadata, exact currency and exact amount.
8. A second distinct successful charge for an already-paid order is an overpayment/reconciliation exception, not an “already paid” success.
9. Webhook receipt and settlement must be durable and idempotent. A verified webhook is acknowledged only after its event is durably recorded; processing can be retried.
10. Refund eligibility, admin exception review, provider submission, provider confirmation and accounting posting are separate states.
11. Do not notify a buyer that money has been refunded until Paystack confirms the refund. Eligibility notifications must use accurate wording.
12. Do not backfill unknown historical FX, discounts or refund allocations with guessed values.

## 3. Proposed data model

Names below are proposed and must be checked against the latest live staging catalog immediately before writing the migration.

### 3.1 Immutable checkout snapshot

Add nullable versioned snapshot fields to `public.orders` for newly created orders, for example:

- `checkout_snapshot_version integer`
- `checkout_snapshot jsonb`

The snapshot should contain the server-calculated currency, currency exponent, display/base currency, FX rate and source/timestamp, markup, item gross values, item quantities, discount and offer details, delivery fee, total, rounding policy and deterministic per-item refundable allocations. It should also preserve the quote creation time and pricing-policy version.

Write the snapshot atomically with order creation using a service-only wrapper around the existing `create_order` transaction (or an equivalently atomic v2 create function). Do not create an order and then make a separate network round trip to attach its snapshot.

Enforce write-once behavior: allow the initial transition from NULL to a valid versioned snapshot, then reject subsequent changes. Historical rows remain NULL.

### 3.2 Payment attempts

Create a private payment-attempt table with, at minimum:

- UUID primary key; text `order_id`; `user_id uuid`
- provider identifier (Paystack first; provider-independent shape)
- unique provider reference
- client idempotency key
- amount in integer minor units, currency and exponent
- snapshot version/hash or immutable quote reference
- state: `initializing`, `pending`, `processing`, `succeeded`, `failed`, `cancelled`, `reconciliation_required`
- provider transaction ID, safe gateway result, created/updated/verified timestamps
- sanitized failure/reconciliation reason

Constraints/indexes:
- unique (provider, provider_reference)
- unique (user_id, idempotency_key)
- at most one active attempt per order (partial unique index over active states)
- indexes for order, user, state and provider transaction lookup

Never store authorization codes, PAN, CVV or unnecessary provider customer payloads in this table.

### 3.3 Durable provider event inbox

Create a private provider-event inbox containing provider, deterministic event key, event type, provider reference/transaction ID, signature-verification result, minimal sanitized payload, received/processed timestamps, processing state, retry count and last safe error.

Use a unique key to make duplicate webhooks idempotent. Paystack webhook handling must verify the HMAC before inserting an event. Do not store the unfiltered raw request if it contains unnecessary personal/payment data.

### 3.4 Refund execution lifecycle

Keep `public.refunds` as the existing customer/admin eligibility/request record. Add a separate private provider-refund lifecycle linked to the legacy refund row and successful payment attempt, with:

- provider refund reference/idempotency key
- exact amount_minor, currency and exponent
- state: `eligible`, `awaiting_approval`, `submitting`, `pending_provider`, `succeeded`, `failed`, `reconciliation_required`
- provider response reference, safe error, submitted/confirmed timestamps

A legacy `approved` row means internal approval/eligibility only. A legacy `processed` row must not be treated as proof that Paystack returned the money. Historical rows without a verifiable provider refund stay explicitly legacy/unreconciled.

## 4. RPC and Edge Function contract

The exact signatures should be finalized while implementing the migration. The intended service-only operations are:

1. **Create order with snapshot** — one database transaction creates the order and immutable quote snapshot.
2. **Create payment attempt** — locks the order, verifies owner/status/snapshot, validates exact amount/currency/exponent, enforces idempotency and one-active-attempt rule, then stores the provider reference before calling Paystack.
3. **Record provider initialization result** — moves the attempt to pending or failed; safe response metadata only.
4. **Record webhook event** — callable only after Edge Function HMAC verification; inserts event idempotently.
5. **Process provider event / verify transaction** — retrieves/validates authoritative Paystack transaction details, matches the attempt, checks exact amount and currency, and settles only that attempt.
6. **Record provider refund submission/result** — tracks submission separately from provider confirmation and only marks success after authoritative confirmation.
7. **Admin reconciliation queue** — exposes safe summaries of duplicate charges, mismatches, stuck attempts and refund exceptions without exposing secrets.

The Edge Function must use the immutable attempt amount and quote snapshot. It must not call the old repricing path for an existing order. Webhook processing should acknowledge a valid event after durable inbox insertion, then process/retry it safely. Client-facing actions must never be able to set payment status, attempt success or refund success directly.

## 5. Settlement behavior

- Lock the attempt and parent order.
- If the attempt is already succeeded, return an idempotent result.
- Reject or quarantine a reference not attached to a known attempt.
- Require exact provider reference, transaction identity, currency and amount equality.
- If the order is unpaid and otherwise payable, mark the attempt succeeded and invoke the existing seller-release/ledger/notification settlement behavior exactly once in the same database transaction.
- If the order is already paid by the same attempt, return idempotently.
- If the order is already paid by a different attempt, mark the new attempt `reconciliation_required`, preserve the event, and create an admin exception. Do not release seller orders or post a second sale.
- If a successful payment arrives after cancellation or another incompatible terminal state, quarantine it for reconciliation; do not silently mark the order paid.
- Failed, abandoned and pending provider attempts must never release seller orders.

The existing settlement function should be replaced or wrapped carefully so that all payment entry points pass through attempt validation. Do not leave an alternate service-role route that can confirm an order without a matched attempt.

## 6. Refund eligibility and execution

For new snapshot-backed orders, cancellation of an unfulfillable seller order should compute eligibility from stored item-level allocations, not current catalog prices or a newly calculated FX rate. Allocate discounts deterministically in minor units so the sum of item allocations reconciles exactly to the captured refundable amount. Delivery-fee treatment must follow the approved delivery/refund policy; do not assume it is refundable or non-refundable without that policy.

- Automatically create eligibility for clear, unfulfillable item/quantity portions.
- Cap cumulative refund attempts at the captured refundable amount, accounting for pending and successful refunds.
- Require admin review where the order is legacy, allocation is missing/ambiguous, provider state is uncertain, or the requested refund exceeds automatic policy.
- Provider submission is idempotent and separate from eligibility.
- Mark provider refund success only after Paystack confirmation.
- Post seller/accounting reversals only once and only in the correct currency.
- Notify the buyer that a refund is complete only after provider confirmation. Before then, say it is being reviewed or processed, as appropriate.

The current legacy `cancel_so` and `refund` functions must be revised or routed through these new controls; merely adding tables is not sufficient.

## 7. Migration implementation order

1. Re-read the staging migration ledger and catalog; confirm 000–025 are actually applied and no 026 object already exists.
2. Add nullable snapshot columns and a write-once guard.
3. Add private attempt, event-inbox, refund-lifecycle and reconciliation structures with constraints/indexes.
4. Add service-only RPCs with explicit empty search paths, fully qualified objects, strict grants and transaction locking.
5. Replace/route settlement and cancellation/refund functions so old bypass paths cannot mutate payment outcomes.
6. Update `supabase/functions/paystack/index.ts` to use snapshot-backed amounts, attempts and durable webhook inbox.
7. Add admin reconciliation read contract and safe customer status contract.
8. Run migration against a disposable local database or equivalent clean schema first; then apply to staging only after review and authorization.
9. Run the acceptance suite and inspect RLS, grants, SECURITY DEFINER search paths, indexes and advisor findings.
10. Keep production untouched. A separate production rollout plan and explicit owner approval are required.

## 8. Required acceptance tests

### Attempts and concurrency
- Same idempotency key returns the same attempt.
- Two concurrent create requests cannot create two active attempts.
- New retry creates a new reference only after the prior attempt is terminal.
- A pending attempt cannot be bypassed by a second attempt.
- Provider reference uniqueness is enforced across orders.

### Amount and quote integrity
- Exact amount/currency succeeds.
- One minor unit under or over fails and enters a safe failure/reconciliation path.
- Currency mismatch fails.
- Attempt amount is derived from the immutable snapshot, not live catalog prices or refreshed FX.
- Snapshot cannot be updated or replaced after creation.
- Legacy orders with no snapshot cannot enter the new automatic retry path without explicit reconciliation.

### Settlement and webhook
- Duplicate webhook is processed once.
- Webhook event is durable before acknowledgement.
- Invalid signature is rejected and not inserted as verified.
- Unknown reference is quarantined.
- Same successful attempt is idempotent.
- A second distinct successful attempt for an already-paid order is flagged as overpayment and does not create duplicate seller ledger entries or notifications.
- Successful payment after cancellation is reconciled, not silently settled.
- Failed/pending attempts never release seller orders.

### Refunds
- Partial and full refunds use frozen item allocations.
- Multiple refunds cannot exceed captured refundable minor units.
- Pending refunds count against the cap.
- Provider timeout does not mark a refund successful.
- Duplicate refund submission does not create duplicate provider refunds.
- Buyer completion notification is sent only after provider confirmation.
- Legacy refund records remain distinguishable from provider-confirmed refunds.
- Ambiguous/legacy orders enter admin review.

### Security and regression
- anon/authenticated cannot write attempts, provider events or refund lifecycle rows.
- Only service-role RPCs can process provider state; admin-only operations require explicit admin checks.
- SECURITY DEFINER functions use empty search paths and schema-qualified objects.
- Existing customer/seller/admin RLS behavior remains intact.
- Existing bank-transfer/manual and pay-on-delivery flows are not misrepresented as Paystack card attempts.
- Existing seller ledger idempotency and order release behavior remain correct.

## 9. Open policy items that block final refund SQL

These are policy/accounting decisions, not safe assumptions to hard-code:

- Whether delivery fee is refundable when all or part of an order is cancelled, and who bears it.
- Treatment of discounts/coupons and promotional funding on partial cancellation.
- Handling of bank-transfer/manual payments and pay-on-delivery refunds.
- Whether a refund requires admin approval in any additional cases beyond ambiguous/legacy exceptions.
- Accounting treatment for FX loss/gain, provider refund fees and seller commission reversals.

Until these are decided, the implementation must use conservative exception handling rather than inventing policy.


## 11. Draft migration artifact created on 2026-11-15

A first additive schema draft now exists at:

- `supabase/migrations/026_payment_lifecycle.sql`
- Target branch: `web-portal`
- Latest migration blob SHA: `9f281c7ac85fdfa5aef83e099a476904623501c2`

A read-only post-application structural check is also drafted at `supabase/tests/026_payment_lifecycle_schema_checks.sql`. It checks the private-table RLS/access boundary, snapshot columns/trigger and key uniqueness structures. It has not been run because 026 has not been applied.

It currently adds:

- nullable versioned checkout snapshot columns on `public.orders`, with a write-once trigger;
- private payment-attempt records with exact minor-unit amount, currency exponent, provider reference, idempotency key and immutable quote identity;
- a durable private provider-event inbox with duplicate-event key and immutable event evidence;
- private provider-refund execution records, separate from legacy `public.refunds`;
- uniqueness/index constraints and private-only access (no direct client or service-role table CRUD; the intended application interface is narrow owner-controlled RPCs).

**Important:** this is a schema foundation draft, not a complete payment lifecycle implementation. It deliberately does not yet replace `create_order`, `confirm_payment_core`, `cancel_so`, `public.refund`, or the Paystack Edge Function. It has not been applied to staging. It must not be deployed alone because the current payment flow does not yet populate checkout snapshots or create/settle attempts.

### Read-only staging reconciliation on 2026-11-15

The staging migration ledger confirms versions 000–025 are applied and 026 is not recorded. The catalog confirms:

- `orders`, `seller_orders`, `order_items`, and `refunds` use text IDs; user IDs are UUID.
- `orders` contains `currency`, `total`, `discount`, `delivery_fee`, `payment_status`, `paid_at` and `ref`, but no checkout snapshot columns yet.
- `private.confirm_payment_core` returns `already` solely from the order's paid status, without matching a distinct successful provider attempt.
- `private.cancel_so` creates legacy `approved` refunds and currently notifies the buyer that a refund is on its way without provider confirmation.
- `public.refund` creates legacy `processed` refunds and seller-ledger entries without calling/confirming the payment provider.
- Existing RLS on orders/refunds/ledger remains enabled; client writes to refunds are not granted by the current policy set.

The next implementation step is to build the atomic snapshot-aware order creation path and narrow service-only attempt/event/refund RPCs, then update the Paystack Edge Function to use them. Settlement and refund behavior must be switched as one coordinated change. Do not apply this draft to staging until SQL validation and the complete integration/test package are ready.

## 10. Change boundary

The migration and schema-check SQL are drafts on `web-portal` only. They have not been applied to staging; no Edge Function has been modified or deployed; no staging data has been written; and production has not been touched. The draft is a schema foundation, not a deployable end-to-end payment lifecycle. It must be completed with atomic snapshot-aware order creation, narrowly scoped service RPCs, coordinated settlement/refund changes, and provider integration tests before staging application.
