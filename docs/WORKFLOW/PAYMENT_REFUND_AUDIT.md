# Refund Lifecycle — Read-only Audit and Target Design

**Date:** 2026-11-16  
**Branch:** `web-portal`  
**Database inspected:** Everneed-staging (`vjiadqygpyebpisxslbx`), read-only  
**Production:** Not queried or changed.

## 1. Current database refund path

Staging currently has:

- `public.refunds` fields for order, seller-order, opener, reason, amount, status, resolution, resolver and timestamps.
- No Paystack transaction reference, provider refund reference, provider refund ID, provider status, idempotency key or provider-event link in the refund record.
- Read policies for buyer, seller and admin visibility; client roles do not have direct insert/update policies.
- `public.refund(text,text,numeric,text)` is authenticated-callable but uses a server-side `need_admin()` check.

The current refund RPC performs local bookkeeping only. It does not call Paystack's Refund API or wait for a provider confirmation. It marks the refund `processed` in the database immediately, adjusts order payment status, and writes seller ledger entries using a pro-rata calculation based on order total and seller-order subtotal.

### Risks

- The database can say `processed` even though no provider refund has been initiated or completed.
- There is no durable provider refund reference or idempotency key, so the platform cannot safely recover an ambiguous provider request.
- The current allocation does not use the immutable checkout snapshot's item-level refundable amounts and can mis-handle discounts, taxes, seller commissions and delivery fees.
- The seller ledger is adjusted at local approval time, not after provider confirmation.
- The current function checks the total order refund ceiling, but seller-order-specific allocation and delivery-fee refund rules need a stronger invariant.

## 2. Paystack refund behaviour to implement

Official Paystack documentation:

- Create a refund with `POST /refund`, passing the original transaction ID/reference. Partial refunds use integer minor units and cannot exceed the original transaction amount. <https://paystack.com/docs/payments/refunds/> <https://docs-v2.paystack.com/api/refund/>
- Supply a stable refund reference (8–64 characters; letters, digits, underscores and hyphens). If the same reference is submitted again, Paystack returns a conflict and instructs the caller to fetch the existing refund; do not treat this as a new failed refund or create a different reference after a timeout. <https://paystack.com/docs/payments/refunds/>
- Refund statuses are `pending`, `processing`, `needs-attention`, `failed`, and `processed`. Only `processed` means the refund was successfully processed. `failed` means the refund failed and the merchant account is credited back; the original transaction returns to `success`. <https://paystack.com/docs/payments/refunds/> <https://support.paystack.com/en/articles/2130434>
- Paystack sends `refund.pending`, `refund.processing`, `refund.needs-attention`, `refund.failed`, and `refund.processed` events. A `needs-attention` refund requires bank details; do not automatically retry it without the required details. <https://paystack.com/docs/payments/refunds/>
- A processed refund can still take up to 10 business days to reach the customer. Paystack processing fees are not refunded. <https://paystack.com/docs/payments/refunds/> <https://support.paystack.com/en/articles/2127106>

## 3. Target architecture — not implemented

1. Keep a refund request separate from the provider refund attempt. A refund request may be approved, rejected, partially allocated or require manual review.
2. Create an immutable refund allocation from the checkout snapshot: item quantity, item amount, discount allocation, seller commission reversal, taxes and delivery-fee policy.
3. Validate the cumulative requested/approved/provider-confirmed refund against both the original paid amount and each seller-order/item refundable allocation.
4. Create a provider refund attempt with the original successful payment attempt/reference, exact amount in minor units, currency, stable unique refund reference and idempotency.
5. Submit to Paystack once. If the request times out, query the existing refund by the same reference; never create a new refund reference just because the response was lost.
6. Store every provider response and webhook in a durable refund-event inbox. Verify webhook signatures and correlate the provider refund reference and original transaction.
7. Treat `pending`, `processing` and `needs-attention` as not completed. Treat `failed` as a failed refund (funds returned to merchant balance), not as a customer refund. Mark provider processing complete only on verified `processed`.
8. Only after provider confirmation should the system finalize customer refund status and post the corresponding seller/platform ledger adjustments. Failed refunds must reverse any provisional accounting.
9. For bank transfer/manual payments, use a separate admin evidence workflow and do not pretend Paystack processed the refund.
10. Keep delivery-fee refunds subject to an explicit policy. Existing checkout snapshots mark this as admin-review-required; do not silently refund or retain it.

## 4. Dependencies and release boundary

- Refunds depend on the verified payment-attempt lifecycle and immutable checkout snapshot.
- Migration 032 currently hardens legacy payment wrappers only; no refund schema or provider behaviour has been changed.
- The next new repository migration number is 034, but no refund migration has been created yet; migration 033 is reserved for the finance journal foundation.
- The delivery-fee refund policy and the treatment of platform transaction fees still need a business decision.
- No staging migration, Edge Function deployment, scheduler or production action was performed for this audit.


## 28 Nov 2026 — staging re-audit / implementation kickoff

**Staging only:** `vjiadqygpyebpisxslbx`. Production not queried.

- `public.refunds` has two existing records: one `approved`, one `processed`. The historical `processed` record is not provider-verified by the current system and must be treated as legacy/unverified evidence, not proof of funds reaching the buyer.
- `private.provider_refunds` has zero records. `private.payment_attempts` has zero `succeeded` attempts, so no staging provider refund positive-path fixture can be exercised yet.
- The current Paystack Edge Function verifies signatures and stores events in the durable inbox, but the webhook branch handles only `charge.success`; other event types (including `refund.*`) are currently marked processed without refund reconciliation. This is a critical gap.
- Current `public.refund()` remains local-only and inserts `processed`, ledger adjustments and payment-status changes without Paystack API confirmation. The staging counts confirm there are no provider-refund records to corroborate those historical statuses.
- PAY-01 PR #75 now blocks parent-order cancellation while paid/partially-refunded; PAY-02 PR #76 provides admin order directory. Neither is merged yet; coordinate integration before FIN-03 migration replay.

### FIN-03 staged implementation acceptance

1. Introduce explicit legacy/unverified provider state and safe provider-refund state mapping; preserve historical data but never imply provider success.
2. Create immutable idempotent provider refund attempt and exact amount/currency/original transaction reference. Use an 8–64 character stable reference for Paystack.
3. Require provider success transaction context for automated Paystack refunds; manual bank-transfer refunds use a separate evidence/confirmation path.
4. Implement submit, reconciliation and verified webhook state transitions: `pending`, `processing`, `needs_attention`, `failed`, `processed`. Only verified `processed` completes refund and posts accounting adjustments. Failed/ambiguous outcomes must not be treated as refunded or retried with a new reference.
5. Store verified refund events durably and idempotently; webhook duplicates/out-of-order events must not regress terminal states.
6. Allocate refunds from immutable checkout snapshot items and seller-package amounts. Legacy orders without snapshots go to manual review; do not invent allocations.
7. No live provider API request in QA. Tests use controlled fixture/mocked responses or Paystack test mode with explicit test transaction; no real refund.

Official Paystack reference (checked 28 Nov 2026): <https://paystack.com/docs/payments/refunds/> and <https://paystack.com/docs/api/refund/>. Paystack refund states and events must be mapped exactly; `processed` means provider-processed, but customer receipt can still take up to 10 business days.
