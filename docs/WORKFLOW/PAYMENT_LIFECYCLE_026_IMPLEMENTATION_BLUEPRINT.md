# Payment Lifecycle 026 — Implementation Blueprint

**Status:** 026 schema foundation is recorded as applied in `Everneed-staging`; end-to-end payment integration remains incomplete. This document does not authorize further migration application or Edge Function deployment.  
**Target branch:** `web-portal`  
**Current repository head:** migration 033 (source-only); staging ledger ends at 029. **Next new migration:** 034.  
**Staging target:** `Everneed-staging` (`vjiadqygpyebpisxslbx`); migrations 026–028 are recorded as applied there. Production is out of scope.

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

The migration 026 schema foundation is now recorded in the `Everneed-staging` migration ledger. Its snapshot columns, private payment-attempt/event/refund tables and snapshot trigger are present in the staging catalog. This does not mean the payment lifecycle is operational: the current Paystack Edge Function still uses the legacy checkout/settlement path, and the snapshot fields are not yet populated by order creation. No Edge Function deployment or production change was performed as part of this follow-up. The next migration must be numbered 027, not 026, and must be coordinated with a compatible Edge Function release.


## 12. Staging state re-check on 2026-11-15 (supersedes the earlier 026-not-applied note)

A fresh read-only catalog and migration-ledger query against project `Everneed-staging` (ref `vjiadqygpyebpisxslbx`) returned migration version `026`, name `payment_lifecycle`. The catalog also contains:

- `public.orders.checkout_snapshot_version` and `public.orders.checkout_snapshot`;
- trigger `orders_checkout_snapshot_immutable` calling `private.guard_order_checkout_snapshot()`;
- `private.payment_attempts`;
- `private.provider_event_inbox`;
- `private.provider_refunds`.

Therefore, the earlier statement that 026 was not applied is stale and is superseded by this observed staging state. This check was read-only; it did not apply, modify, or backfill anything. The presence of the schema objects does not prove that the Edge Function has migrated to them or that behavioral tests pass.

### Next implementation slice: atomic checkout snapshot wrapper (migration 027)

The existing `public.create_order(...)` is a large SECURITY DEFINER function that atomically reserves stock and creates the order, seller-order rows, order-item rows, commission rows and offer redemption. Rewriting it wholesale would unnecessarily duplicate critical marketplace behavior.

The safer direction is a new service-only wrapper that calls the existing `create_order` within the same database transaction, then builds and attaches a versioned snapshot from the persisted `orders` and `order_items` rows before returning. The wrapper must:

1. accept only server-calculated pricing provenance (FX rate/source/fetched time, markup and pricing-policy version) from the trusted Edge Function;
2. derive order ID, owner, currency, total, discount, delivery fee and item IDs/quantities/prices from persisted rows, not from client-provided snapshot JSON;
3. validate currency exponent against an explicit supported-currency map and validate all numeric context;
4. construct deterministic item-level refundable allocations, including deterministic handling of discount rounding; delivery-fee refund treatment remains an admin exception until policy is decided;
5. compute a SHA-256 digest in PostgreSQL using the already-installed `extensions.digest` function, store it on the order, and bind future payment attempts to that exact hash;
6. write the snapshot and hash once, in the same transaction as order creation, so any validation/attachment failure rolls back the order, stock reservations and offer redemption;
7. retain a legacy path only for non-card/manual flows that are explicitly routed as exceptions; do not silently let card checkout create a snapshotless order.

The wrapper must be paired with an Edge Function change. Do not revoke the old `create_order` grant or apply 027 until the Edge Function is ready to call the new wrapper; do not leave the legacy RPC as an alternate card-order creation path after cutover. The 027 implementation must also add a write-once `orders.checkout_snapshot_hash` column and extend the existing snapshot guard to protect it.

### Current staging evidence

- Staging migration ledger records `026 / payment_lifecycle`.
- Staging catalog confirms the three private lifecycle tables and both snapshot columns.
- Staging catalog confirms the snapshot immutability trigger.
- Staging catalog confirms `order_items` uses text IDs and persists `unit_price`, `qty`, and `line_total`; `orders` persists numeric `total`, `discount`, and `delivery_fee`.
- The `pgcrypto` extension is installed in schema `extensions`; `extensions.digest(bytea,text)` and `extensions.digest(text,text)` are available.
- The live `public.create_order` function is owned by `postgres`, is SECURITY DEFINER, and remains the legacy entry point.
- The fetched Paystack Edge Function still calls `db.rpc("create_order", ...)`, recalculates price during payment initialization, and calls the legacy `confirm_payment` RPC. It has not yet been converted to payment attempts or the durable event inbox.

This update corrects documentation only. It does not modify staging, production, payment data, migration records, or Edge Functions.


### Migration 027 draft created on 2026-11-15

The next additive implementation slice is now drafted on `web-portal`:

- `supabase/migrations/027_payment_checkout_snapshot.sql`
  - Wraps the existing `public.create_order` function rather than duplicating its stock, offer, commission, seller-order and delivery-routing logic.
  - Creates the order and then builds a snapshot from persisted order/item rows in the same PostgreSQL transaction. Any snapshot validation or attachment failure rolls back the order creation.
  - Adds `orders.checkout_snapshot_hash`, computes SHA-256 with the installed `extensions.digest`, and extends the write-once trigger to protect and verify the hash.
  - Stores FX rate/source/fetch time, markup, effective rate and pricing-policy version supplied by the trusted server function; validates the effective-rate calculation and supported currency exponent.
  - Stores persisted order totals and deterministic item-level net refundable allocations; delivery-fee refunds are explicitly marked for admin review.
  - Exposes only a service-role execute grant for the new wrapper. The old `create_order` grant is intentionally not revoked in this draft because the current Edge Function still calls it; migration application and Edge Function cutover must be coordinated to avoid breaking checkout or leaving a permanent bypass.

- `supabase/tests/027_payment_checkout_snapshot_checks.sql`
  - Structural checks for the hash column, immutable trigger, wrapper signature, SECURITY DEFINER configuration and role grants.
  - Includes a read-only count of complete/incomplete snapshot-hash pairs.
  - Not run because 027 has not been applied.

The draft is **not deployment-ready**. It has not been executed against PostgreSQL, and no SQL parser or database test has validated its syntax/behavior. In particular, test the wrapper against real order fixtures covering multi-item discount rounding, free/paid delivery thresholds, every supported currency, official and third-party sellers, offer redemption, stock rollback, and legacy/manual payment methods. A subsequent integration slice must create and bind payment attempts to `checkout_snapshot_hash`, update Paystack checkout/verification/webhooks, and remove the legacy bypass only as part of a coordinated cutover.

This draft and documentation update do not change staging or production.


### Payment-attempt RPC and Paystack integration draft (migration 028)

The next implementation slice is now drafted on `web-portal`:

- `supabase/migrations/028_payment_attempt_rpc.sql`
  - `create_payment_attempt`: locks the order, verifies owner and card-payment eligibility, recomputes the persisted snapshot SHA-256, derives exact minor-unit amount/currency/exponent from the snapshot, enforces idempotency, and reuses an existing active attempt instead of creating a second active charge.
  - `record_payment_attempt_initialization`: records pending/failed initialization outcomes without allowing the client to set payment state.
  - `record_verified_provider_event`: accepts only service-role calls from the HMAC-verifying Edge Function and inserts minimal sanitized event evidence idempotently.
  - `settle_verified_payment_attempt`: locks attempt/order, validates owner/snapshot/currency identity and exact provider amount/currency, prevents duplicate settlement, and routes second charges, mismatches, terminal-attempt successes and paid-after-cancellation into reconciliation. For a first valid payment it updates the attempt and calls the existing settlement core in the same database transaction.
  - `mark_provider_event_processed`: records processed/retry/quarantined state and safe errors.
  - All RPCs have empty search paths and service-role-only execute grants.

- `supabase/tests/028_payment_attempt_rpc_checks.sql`
  - Checks the five RPC signatures, SECURITY DEFINER status, explicit search paths and client/service-role grants.
  - Read-only summary counts for succeeded/reconciliation attempts and provider-event backlog.
  - Not run because migration 028 is unapplied.

The Paystack Edge Function at `supabase/functions/paystack/index.ts` has also been updated on the branch:

- Card order creation now calls `create_order_with_snapshot` and passes server-generated FX provenance; manual bank transfer, WhatsApp and pay-on-delivery retain their existing path for now.
- Card initialization/charge now creates or reuses a snapshot-bound attempt and uses the exact stored `amount_minor`, currency and provider reference. It no longer reprices an existing card order on each initialization/retry.
- Successful charge settlement first re-verifies the transaction directly with Paystack, then calls `settle_verified_payment_attempt`.
- Webhooks verify the Paystack HMAC, persist a sanitized durable inbox record, re-verify successful transactions with Paystack, and record processed/retry/quarantined outcomes.
- Pay-on-delivery saved-card collection remains on its legacy route and is explicitly not represented as a snapshot-backed payment attempt.

### Integration limitations and required next work

This is an implementation draft, not a release candidate:

1. Migrations 027 and 028 have not been applied or SQL-executed. No Edge Function was deployed.
2. Existing card orders created before this cutover have no immutable snapshot/attempt. Their late provider successes are not auto-settled by the new attempt RPC; they need a controlled legacy reconciliation path before rollout.
3. The legacy `public.confirm_payment`/admin confirmation route still exists. The Edge Function's new card path no longer calls it, but all alternate grants/callers must be audited and closed or explicitly retained for admin/manual payment flows before production cutover.
4. Provider event retry states are persisted, but a scheduled worker/cron to drain retries and stale `initializing` attempts has not been implemented.
5. Paystack authorization URL recovery after a crash between provider initialization and recording its response needs a retry/verification design; the current code avoids duplicate initialization on a reused pending attempt but may return a verification-required state when no URL was persisted.
6. A failed charge after provider acceptance, transaction timeout, duplicate webhook, and concurrency race need behavioral tests with a mocked Paystack API and a disposable database.
7. Pay-on-delivery charge/refund behavior, bank-transfer proof/settlement, and legacy card-order reconciliation remain separate work. Do not infer that these paths now use payment attempts.

The current code is saved only on `web-portal`. No migration was applied, no provider request was made during this work, no Edge Function was deployed, no staging data was changed, and production remains untouched.


### Artifact integrity and handoff snapshot

Latest branch blob identifiers after the final review edits:

| Artifact | Latest blob SHA |
|---|---|
| `supabase/migrations/027_payment_checkout_snapshot.sql` | `79797d0f70036dbcb9347687a92d94b9b5072238` |
| `supabase/migrations/028_payment_attempt_rpc.sql` | `09b950d64e9cb1c3eb979a4cb10f64db3e506df8` |
| `supabase/tests/027_payment_checkout_snapshot_checks.sql` | `55afdb09098f603592a294de0aa123eb7d60ece9` |
| `supabase/tests/028_payment_attempt_rpc_checks.sql` | `3bc65ff7dd743dfe01c5ce22981d02f4009f1ec4` |
| `supabase/functions/paystack/index.ts` | `6a6e122a2353a8dd2a7c9cff327fc2621a957255` |

The branch implementation has had a source-level review against the current staging catalog and existing settlement function. This is not a substitute for TypeScript compilation, SQL parsing/execution, provider sandbox tests or concurrency tests. Known rollout blockers remain: legacy in-flight card orders, legacy admin/manual confirmation callers, stale initializing-attempt recovery, durable inbox retry worker, and pay-on-delivery/manual-payment separation.

No pull request was opened, no deployment was triggered, no migration was applied and no production resource was changed.


### 2026-11-16 follow-up — webhook retry acknowledgement

A reliability review found that the webhook handler persisted a verified event and marked it `retry` after inline settlement failed, but still returned HTTP 200. That acknowledged delivery to Paystack even though no scheduled inbox worker exists yet.

The handler now returns HTTP 503 after recording the retry state. Paystack therefore treats the delivery as unacknowledged and can redeliver it; the deterministic provider/event key and idempotent settlement path make redelivery safe. The ordinary successful path still returns HTTP 200 only after processing has completed or the event has been deliberately quarantined.

This is a bounded recovery measure, not a replacement for a durable inbox worker. Paystack documents automatic retries for failed live-mode deliveries for up to 72 hours (initially every 3 minutes, then hourly); test-mode retry behavior has a shorter window. Events that exhaust provider retries still require monitoring and manual or scheduled recovery. See the official [Paystack webhooks documentation](https://paystack.com/docs/payments/webhooks/).

A static repository check now guards against accidentally restoring the 2xx-on-processing-failure behavior. This change is branch-only; it does not deploy the Edge Function or alter staging/production.


## Current baseline correction — 16 Nov 2026

The introductory statements in the original blueprint are historical and are superseded by this reconciliation. The repository migration directory and read-only staging ledger both contain migrations through `029_payment_recovery_worker.sql`; migration 029 was applied to staging by the repository's former push-triggered workflow on 16 Nov 2026. That automatic trigger has since been disabled. Do not edit or reapply migration 029. The next new repository migration is **034**. Staging is pending migrations 030–033. Migration 033 establishes a private immutable double-entry journal and service-only balanced posting RPC; it is source-only and not applied.

Migration 029 adds event lease metadata, bounded retry/dead-letter states, atomic `SKIP LOCKED` claims, lease-token guarded completion, exponential retry backoff, corrected duplicate-event detection, and stronger immutable checkout snapshot validation in settlement. The staging ledger confirms 029 is recorded. No payment-attempt or provider-event rows were present at the pre-029 audit baseline; this remains a structural rather than live-payment test.

Migration 030 is source-only and adds the signed-event flag to the recovery claim result plus a service-only lookup of trusted attempt/order context for the worker. Migration 031 is also source-only: it adds separate stale-attempt recovery leases, bounded retries, provider status resolution, and an insert guard that blocks a new charge while an earlier attempt is `succeeded` or remains in `reconciliation_required`. Migration 032 is source-only and tightens the search path on legacy service-role payment wrappers whose bodies already use fully-qualified references. The `payment-recovery` Edge Function is also source-only: it verifies the transaction with Paystack, compares the provider metadata and amount/currency to the persisted attempt context, then calls the settlement RPC. It is not deployed or scheduled. `pg_cron` and `pg_net` remain uninstalled, and stale `initializing`/pending attempt recovery is not yet implemented.

The staging `paystack` Edge Function remains ACTIVE v1; newer webhook retry and recovery-worker source has not been deployed. No production migration, Edge Function deployment, or production change is authorized by this status note. The next safe steps are to pass local replay/SQL tests for 029 and 030, review the worker's authorization and retry semantics, then request explicit approval before manually applying 030 or deploying any function to staging.
