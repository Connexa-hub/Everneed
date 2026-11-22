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

## 4. Dependencies and release boundary — current staging checkpoint

- FIN-04 depends on the verified payment-attempt lifecycle, immutable checkout snapshots and FIN-03 settlement journal (migration 057 is applied to staging and test 057 passed with rollback fixtures).
- Migration 026's `private.provider_refunds` schema exists in staging, but there is no narrow refund lifecycle RPC, Paystack refund API integration, refund webhook correlation or refund journal posting. The table alone is not an executable refund flow.
- Current legacy `public.refund` and `private.cancel_so` behaviour remains unchanged and unsafe to treat as provider-confirmed: local records can be marked `processed` or `approved`, seller-ledger adjustments occur before provider confirmation, and automated cancellation can notify the buyer that a refund is on its way without submitting a provider refund.
- Refund policy decisions still required: delivery-fee treatment, promotion funding reversal, commission/tax allocation, provider-fee treatment, FX, manual-payment evidence, and seller recovery if the payable was already withdrawn.
- No refund migration, provider request, webhook, refund journal, payout or production action was performed in this checkpoint. Staging has FIN-03 journal integration only; production untouched.

## 5. Latest refund audit checkpoint — 22 Nov 2026

The existing refund RPC still uses a numeric major-unit amount and caps the cumulative `approved/processed` refund against the parent order total—not each seller-order/item refundable allocation. It writes a local `processed` row immediately, calculates seller reversal pro-rata from parent total and seller subtotal, returns commission to the seller ledger, and marks the parent payment status based on local records. It does not call Paystack or verify a refund status.

The `private.cancel_so` path auto-creates an `approved` refund for a pro-rata share of merchandise (excluding delivery by its current formula), reverses pending/available seller-ledger sale/commission rows immediately, and sends “refund is on its way” notification/admin task. It does not execute provider refund. These paths must be replaced/routed to a durable refund request and provider lifecycle before launch; do not interpret current `approved`/`processed` as money returned.

FIN-04 acceptance sequence: immutable per-item/store refund allocation; pending/processing/needs-attention/failed/processed provider state; stable idempotent provider reference; cumulative caps include pending attempts; signed webhook and provider verify/reconciliation; refund journal posting only on provider-confirmed processing; failure releases reservation/reverses provisional accounting; admin evidence path for manual payments; buyer completion notification only after confirmation. Delivery, promotion and fee allocation policy must be approved before coding.


## 6. Proposed Everneed refund policy defaults — owner approval required

Recommended baseline for the next implementation (not approved or active):

- **Refund requests vs provider refunds:** keep a request/decision record separate from provider attempts. Approval does not mean money returned. Reserve the refundable amount when a provider attempt is submitted; pending/processing/needs-attention attempts count toward the cap. Release the reservation on confirmed failure. Mark complete only after verified provider `processed`.
- **Allocation:** use frozen v2 per-item/store allocations in minor units; never reprice from current catalogue, refreshed FX, display prices or parent-order pro-rata. Split multi-item refunds by item/quantity with deterministic rounding/residuals. Cumulative pending + successful refunds cannot exceed captured buyer payment or each item/store refundable cap.
- **Promotion funding:** reverse the original funding split. Seller-funded discount affects the seller liability/commission basis; platform-funded subsidy reverses the corresponding platform-promotion expense only on confirmed refund. Do not make a seller fund a platform subsidy or vice versa.
- **Delivery fees:** proposed default is full delivery-fee refund when the whole order is cancelled before courier dispatch/collection and no delivery cost is incurred. After dispatch, no automatic delivery refund; require admin review/evidence. For partial seller cancellation, retain the fee only if route/service cost is unchanged; otherwise recalculate and disclose, with admin approval. This requires policy approval and snapshot fields.
- **Provider fees:** Paystack fees are not refunded by the provider; record them as platform processing expense. Do not silently deduct an undisclosed refund fee from the customer or seller.
- **Seller already paid:** do not create an unapproved negative stored-value wallet or silently debit bank. Proposed recovery is an offset against future seller earnings with payout hold and admin review; if no recoverable balance exists, route to a defined platform-loss/collection process. Approve the legal/contract policy before enabling.
- **Manual methods:** bank-transfer and cash-on-delivery refunds use a separate evidence-based admin workflow (dual approval above a configurable threshold, proof/reference, reconciliation), not the Paystack provider state machine.
- **Notifications:** request/approval messages may say “requested/under review”; only verified provider completion may say “refund completed”. The legacy `cancel_so` “on its way” message must be replaced.
- **Legacy orders/refunds:** missing immutable allocation or provider/payment evidence stays admin-review-only. Existing `approved`/`processed` rows are not backfilled as provider-confirmed success.

Before coding FIN-04, owner/finance must approve delivery-fee policy, seller recovery, manual-refund controls, refund authorization thresholds and commission/tax handling. This proposal deliberately avoids an automatic provider call or journal posting.


## FIN-03 testing checkpoint — 22 Nov 2026
Staging Paystack function deployed v14 with explicit attempt context binding after owner approval. SQL regression tests 055, 056, 057 passed on staging with rollback-only fixtures. Production untouched. Actual sandbox HTTP tests are pending because this connector cannot invoke Edge Function endpoints or run Deno tests. No payment/refund request submitted.