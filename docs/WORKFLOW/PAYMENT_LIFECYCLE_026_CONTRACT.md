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

