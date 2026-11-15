# Payment lifecycle contract — Migration 026

**Status:** design contract; not applied to any database  
**Target branch:** `web-portal`  
**Target database:** `Everneed-staging` only after review  
**Production:** explicitly out of scope  
**Owner:** ChatGPT — database, payment and security backend  
**UI owner:** Claude — checkout, order screens and all UI/UX

## Why this comes next

The current Paystack Edge Function creates a new reference using the order ID and current timestamp, initializes Paystack directly, then calls `confirm_payment` from a successful transaction. There is no durable row for each attempt. `settle()` returns success when an order is already paid, without proving that a second successful provider reference is the one that originally paid it. It also accepts an amount greater than the expected amount and recomputes price from live products/offers/FX on later payment calls.

This leaves no reliable record for retries, late webhooks, multiple successful charges, or reconciliation.

## Scope of 026

Migration 026 establishes the database contract and does not execute a Paystack charge, refund, or transfer. The Edge Function must be updated in the same release before the new lifecycle is enabled.

### 1. Immutable payment attempts

Create a private payment-attempt table (not directly exposed to browser roles) with at least:

- UUID primary key
- `order_id` referencing `public.orders(id)`
- `user_id` referencing `auth.users(id)`
- provider fixed to `paystack`
- globally unique provider reference
- caller idempotency key, unique per user
- amount in integer minor units and ISO currency code
- lifecycle status: `initializing`, `pending`, `succeeded`, `failed`, `abandoned`, `review_required`, `duplicate_success`
- provider transaction ID (when available), authorization URL/access code only if operationally necessary
- created/updated/verified timestamps and a bounded failure code/message

The attempt's amount, currency, order and owner are immutable after creation. Only trusted server-side transition functions may update lifecycle fields. Never store the reusable authorization code or full card data in this table.

Indexes/constraints:
- unique provider reference
- unique (user_id, idempotency_key)
- index (order_id, created_at desc)
- index (status, updated_at) for operational recovery
- one successful primary payment per order, enforced transactionally by the settlement function rather than by assuming a unique partial index will handle races alone.

### 2. Checkout snapshot and amount rules

At the first payment initialization, calculate the order amount once on the server and persist the exact amount/currency used for that attempt. Subsequent retries must use the persisted checkout snapshot, not today's product prices, offer eligibility, delivery fee, or FX rate.

Represent money sent to Paystack as integer minor units. Currency exponent rules must be explicit and tested (including NGN/KES versus two-decimal currencies). Store the FX rate, source, quote timestamp and markup used to arrive at the shopper total where applicable. Do not silently mutate a paid or payment-pending order's total.

A changed cart or price should require a new customer-approved checkout/order revision, not an invisible repricing of an existing payment attempt.

### 3. Trusted creation and transitions

Expose only narrowly scoped server-side functions, preferably in the non-exposed `private` schema, with explicit grants to `service_role` only:

- create/reuse attempt: verify order owner, payable state, amount/currency snapshot and idempotency key; serialize concurrent creation for the same order/user.
- mark initialized/pending: bind the provider response to the already-created reference.
- record provider result: accept only verified provider transaction facts and transition the attempt.
- settle order: lock order and attempt, require exact provider reference, matching order/user, exact amount and currency, and successful provider status before calling the existing payment-confirmation core.
- flag duplicate success: if a different attempt succeeds after the order is paid, retain it as `duplicate_success` and create a reconciliation case; do not silently return success or discard it.

No client role may insert, update, or delete payment attempts. Avoid public SECURITY DEFINER RPCs; revoke EXECUTE from PUBLIC, anon and authenticated explicitly.

### 4. Durable webhook idempotency

Add a provider-event inbox table with a unique provider event key/reference and event type, received timestamp, processing status, processed timestamp, and a minimal payload/verified-facts record. Do not persist unnecessary customer/card PII.

Webhook processing must:
1. Verify the Paystack HMAC signature against the raw request body.
2. Persist/deduplicate the event before applying business effects.
3. Verify the transaction against Paystack using the stored attempt reference (not metadata alone).
4. Match provider reference, order, owner, exact amount and currency.
5. Apply settlement exactly once in a database transaction.
6. Mark mismatches, duplicate successes and out-of-order events for review/reconciliation rather than treating them as paid.

A valid signature proves origin/integrity, not that the payment belongs to this order or has the correct amount.

### 5. Backward compatibility

- Keep existing `orders.ref` as a legacy/display reference during transition; do not use it as the only payment-attempt ledger.
- Existing bank-transfer and manual admin-confirmation flows remain separate and must not be represented as Paystack attempts.
- Pay-on-delivery is not redesigned in 026; its delivery/payment separation is a later milestone. Do not make 026 accidentally mark a delivered unpaid order as paid.
- Preserve existing order and seller-order RLS. Payment-attempt internals remain server-only.
- No backfill should invent payment attempts for historical orders. Historical orders may have a legacy reference but no trustworthy per-attempt facts.

## Edge Function release contract

Update `supabase/functions/paystack/index.ts` alongside the migration:

- `init` and `charge`: create/reuse the attempt first, then send its exact reference/amount/currency to Paystack.
- Persist provider initialization failures against that attempt.
- `verify`: only verify a reference belonging to the authenticated user's order/attempt; never accept a caller-supplied metadata claim as ownership proof.
- webhook: inbox/deduplicate, provider-verify, then settle.
- on repeated successful charge for an already-paid order: mark duplicate and alert/reconcile; do not return ordinary success.
- remove repricing from retry/verification paths.
- preserve current CORS/auth behavior unless separately reviewed; do not broaden public access.

## Required automated tests before staging activation

1. Same idempotency key returns the same attempt/reference; different keys create distinct attempts only when policy allows.
2. Two concurrent init requests cannot create conflicting active attempts or overwrite the locked checkout snapshot.
3. Wrong user, wrong order, unknown reference, wrong amount, overpayment, underpayment and wrong currency are rejected.
4. Duplicate webhook delivery has one business effect.
5. Out-of-order pending/failure/success events cannot regress a succeeded attempt.
6. Two distinct successful references for one order produce one settlement and one duplicate-success reconciliation case.
7. A late success after cancellation is held for review and does not silently revive the order.
8. Provider initialization failure is durable and retryable.
9. Client roles cannot read or mutate payment attempts or webhook inbox.
10. Existing bank transfer/manual confirmation flows still work and do not fabricate Paystack attempts.
11. Regression: three sellers/one checkout still creates one parent-order payment and the expected seller-order/ledger effects exactly once.
12. Regression: no seller is notified and no seller earnings are posted before verified payment settlement.

## Acceptance gates

- Migration is reviewed and applied to staging only.
- Edge Function deployment and database migration are released together; do not enable a half-migrated flow.
- SQL tests, Edge Function tests, RLS tests and Supabase advisors are clean or have documented accepted exceptions.
- Exercise Paystack test-mode transactions only; no live charge/refund/transfer.
- Reconcile a successful, failed, duplicate and late payment in staging before considering production.
- Production deployment requires a separate explicit approval after staging evidence is reviewed.

## Important implementation note

Do not create the migration by guessing a filename. Use the repository's established migration naming convention and the Supabase CLI's `supabase migration new` workflow, then verify the staging migration history still ends at 025 before applying 026.

## 6. Unfulfillable-order refund eligibility and controlled processing

**Approved policy:** Everneed automatically determines refund eligibility when an order or seller-order portion cannot be fulfilled, while keeping the actual refund provider-confirmed and fully auditable. This policy applies to whole-order and partial multi-seller-order failures.

### Eligibility triggers

Evaluate refund eligibility when a fulfilment unit is explicitly marked unfulfillable, including:
- seller cancellation or confirmed inability to supply;
- stock or product unavailability discovered after payment;
- parcel loss or confirmed damage in hub custody or carrier transit;
- an admin-approved fulfilment failure;
- a partial quantity shortfall where only some line quantities can be supplied.

A delivery delay alone is not an automatic refund trigger unless the applicable customer policy says the deadline has been breached. A cancellation request, dispute or suspected fraud must follow its own review path.

### Calculation rules

- Calculate from the immutable checkout snapshot and captured payment allocation, never current catalogue prices, current FX rates or current offer settings.
- Identify the exact affected seller order, order lines and quantities. A partial failure must not automatically refund fulfilled seller orders or unaffected quantities.
- Allocate discounts and promotions proportionally using the checkout-time allocation rule, with deterministic minor-unit rounding and a documented remainder rule.
- Include or exclude delivery charges, taxes, platform fees and other charges only under an approved customer-facing policy. Do not invent deductions or retain fees simply because they were incurred internally.
- Enforce a cumulative refund ceiling: successful plus in-flight refunds for an attempt/order allocation may never exceed the captured amount available for refund.
- Preserve the original payment, seller allocation and journal history. A refund is a separate linked financial event, not an edit to the original payment.

### Eligibility and refund states

Keep eligibility assessment separate from provider execution. Suggested states:
- `not_evaluated`
- `eligible`
- `review_required`
- `blocked`
- `requested`
- `processing`
- `succeeded`
- `failed`
- `reconciliation_required`

An eligibility record should identify the trigger, affected seller order/lines/quantities, calculated amount and currency, calculation version, source checkout snapshot, policy version, evidence/reason, actor or system source, timestamps and review decision.

### Controlled automation

- Automatically assess and create an eligible refund request for clear, policy-covered unfulfillable quantities.
- Automatically submit only when the captured payment is verified, the allocation is unambiguous, the amount is within the refundable balance, there is no conflicting dispute/refund, and the provider supports the operation.
- Route ambiguous cases to an admin review queue: partial delivery with disputed charges, delivery-fee allocation uncertainty, damaged goods with a replacement option, chargebacks, suspicious activity, and any case where the policy does not define the deduction or entitlement.
- Use an idempotency key per refund request and persist the provider refund reference before treating submission as complete.
- A timeout or unknown provider response is `reconciliation_required`, not `failed`; verify provider state before retrying to avoid duplicate refunds.
- Mark `succeeded` only after provider confirmation or authoritative reconciliation. A successful API submission alone is not proof of a completed refund.
- Notify the customer with the assessed amount, currency, affected items and status; do not expose internal fraud or risk signals.

### Required refund tests

1. Full unfulfillable order creates one eligible refund request bounded by the captured amount.
2. One seller-order fails in a multi-seller checkout; unaffected seller orders remain payable/fulfillable and are not refunded.
3. Partial line quantity failure refunds only the affected quantity and its correctly allocated discount.
4. Repeated fulfilment-failure events create no duplicate refund request.
5. Cumulative successful and in-flight refunds cannot exceed the captured refundable balance.
6. Unknown provider outcome is reconciled before any retry.
7. Provider rejection or refund failure remains visible and does not falsely mark the customer as refunded.
8. Dispute/chargeback conflicts and ambiguous fee allocation route to review.
9. Customer notifications reflect provider-confirmed status, not merely request submission.
10. Refunds create linked accounting events suitable for the shared financial journal; they never rewrite the original payment.

## 7. Repository reconciliation findings (read-only, 15 Nov 2026)

The following existing implementation details were confirmed in `web-portal` migrations `000_baseline.sql`, `004_marketplace_core.sql`, `006_marketplace_rls.sql`, `007_marketplace_functions.sql`, `008_hardening.sql`, the current `supabase/functions/paystack/index.ts`, and `docs/WORKFLOW/ENVIRONMENTS.md`.

### Existing order and refund schema

- Parent order IDs, seller-order IDs and order-item IDs are text UUID strings, not PostgreSQL UUID columns. Migration 026 must preserve these exact FK types.
- `orders.total`, `orders.delivery_fee`, `order_items.unit_price`, `order_items.line_total`, `refunds.amount` and seller ledger amounts are numeric major-unit values. The new payment-attempt layer should use integer minor units for provider amounts and preserve an explicit conversion boundary.
- Existing `refunds` status constraint is limited to `requested`, `approved`, `processed`, `rejected`. It has no provider reference, provider status, idempotency key, currency, amount-minor, eligibility calculation version or checkout allocation snapshot.
- `private.cancel_so` creates an `approved` refund row for a seller-order cancellation, sends a customer message that a refund is on its way, and alerts admins to process it. It does not call Paystack.
- `public.refund` marks an admin refund `processed` immediately and writes seller ledger adjustments. It does not call Paystack or verify a provider refund. These legacy semantics must not be reused as proof that a card refund was sent or completed.
- Current automatic partial refund calculation prorates seller line totals against parent total less delivery fee. It is a legacy allocation formula, not a sufficiently precise checkout-time refund allocation contract for discounts, taxes or line quantities.
- Existing refund read RLS permits the buyer, admin and relevant seller to read refund rows; client write grants are revoked. Preserve privacy and ensure provider metadata remains private/admin-only.
- `private.confirm_payment_core` locks the parent order and returns `already` when `payment_status='paid'`, without comparing the incoming provider transaction to the original successful attempt. It creates seller ledger entries and seller notifications on first settlement.
- `public.create_order` stores item and parent-order snapshots, but does not currently persist a complete immutable payment quote including rate source/time, FX markup, offer allocation, delivery fee policy version and per-line refund allocation. The payment attempt/quote design must add this without rewriting legacy orders.
- Existing SQL uses text amounts and numeric major units. Paystack API expects integer minor units. For the currently configured currencies (NGN, GHS, KES, ZAR, GBP, USD), all use two decimal places for minor-unit conversion; implement an explicit currency exponent map and tests rather than assuming that all currencies globally use 2 decimals.
- The current SQL `create_order` sets a display rounding variable to zero for NGN and KES when creating `order_items.unit_price`, while the parent total and line totals are rounded to two decimal places. This is a separate pricing precision inconsistency to test and correct in a controlled way; do not silently rewrite existing orders.

### Environment boundary

- `docs/WORKFLOW/ENVIRONMENTS.md` states that staging has migrations through 025 and that 026 is the next numbered migration.
- The staging workflow applies numbered migrations to `Everneed-staging`; live retains timestamped historical migrations and requires manual owner approval. Never run a generic migration push against live.
- The 026 migration must be created on `web-portal`, with the repository's numeric naming convention, and tested only against staging. Do not infer that a repository migration file is already applied merely because a staging history row exists; verify the exact staging migration history before any apply.
- This review was read-only. No migration was created or applied, no Edge Function was deployed, and no Supabase data was changed.

### Implementation consequences

1. Add payment-attempt and durable provider-event records in a private/server-only boundary, preserving text order IDs and user UUID ownership.
2. Introduce a versioned immutable checkout/payment quote snapshot for new orders/attempts. Historical orders without trustworthy facts remain explicitly legacy/unreconciled; do not fabricate snapshots.
3. Add a distinct provider refund lifecycle linked to legacy `refunds` rows or introduce a compatible extension with strict state transitions. Do not reinterpret legacy `approved` or `processed` as Paystack states.
4. Separate refund eligibility, admin approval where required, provider submission, provider confirmation and accounting posting. Customer notifications must describe the actual stage accurately.
5. Before enabling the new Paystack flow, update the Edge Function and SQL settlement path together; do not deploy only one side.
6. Test and explicitly decide how historical/manual bank-transfer orders and pay-on-delivery are handled. They must not be misrepresented as Paystack payment attempts.
