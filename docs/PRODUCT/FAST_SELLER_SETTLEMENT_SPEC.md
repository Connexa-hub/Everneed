# Everneed Fast Seller Settlement — Implementation Specification

**Status:** Approved product direction; engineering specification pending implementation and provider/legal gates  
**Branch:** `web-portal`  
**Date:** 16 November 2026  
**Scope:** Seller-package settlement eligibility, holds, payout orchestration and reconciliation

## 1. Product decision

Everneed should make undisputed seller proceeds eligible for settlement promptly after verified delivery. There is no arbitrary platform-imposed waiting period in the intended model.

A seller package becomes **eligible for payout evaluation** only when all of the following are true:

1. The customer payment for the relevant package has been verified as successful by the payment provider and reconciled to the order amount and currency.
2. Delivery of that specific seller package has been confirmed using the approved proof-of-delivery process. A generic parent-order status is not sufficient for a multi-seller order.
3. No open return, refund, complaint, chargeback, fraud review or other active dispute applies to the package or amount.
4. The payable amount has been calculated from the immutable order/package snapshot and itemised, authorised adjustments.
5. The seller and destination payout account pass required verification and provider checks.
6. The provider-approved marketplace collection and payout structure is active for the actual legal contracting entity.

When those checks pass, the system should queue the payout without an additional arbitrary hold. Actual transfer timing remains subject to provider processing, bank rails, cut-offs, compliance review and reconciliation.

**Important distinction:** delivery confirmation creates eligibility; it does not itself prove that the provider has settled funds or that a transfer has succeeded.

## 2. Package-level, not parent-order-level

- Track payable amounts by seller package (seller order), even when one buyer checkout creates a parent order containing several sellers.
- A delivered package may proceed independently while another package is still in transit, returned or disputed.
- Never release one seller's funds based only on another seller's delivery event.
- Allocate refunds, disputes, delivery costs, commission and adjustments to the affected package and line items.
- If an issue affects only part of a package, hold only the evidenced affected amount where the approved provider and accounting structure permits; leave the undisputed remainder eligible.
- If the issue cannot yet be allocated reliably, place a temporary, reviewable hold on the smallest amount reasonably necessary and record why.

## 3. State model

Keep payment, delivery, dispute and payout states separate. Do not overload the order's customer-facing status with money movement.

Suggested package payout states:

- `not_eligible` — payment or delivery prerequisites are incomplete.
- `eligible` — all eligibility checks pass.
- `held` — an active case or documented legal/provider/compliance reason blocks all or part of the payable amount.
- `queued` — an idempotent payout instruction is ready for provider submission.
- `processing` — provider accepted the transfer request; final outcome is not yet known.
- `paid` — provider-confirmed successful transfer reconciled to the exact seller, amount and currency.
- `failed` — provider definitively rejected or failed the transfer; payable remains outstanding.
- `reversed` — provider/bank confirms a previously successful transfer was reversed or returned.
- `cancelled` — queued instruction safely cancelled before provider acceptance.

A timeout or unknown provider response is **not** a failure and must not cause a fresh transfer. Mark it `unknown/reconciliation_required` (or an equivalent explicit status) and query/reconcile the original provider reference before retrying.

## 4. Holds and releases

Create a hold record with: seller package, affected line items or amount, currency, reason code, source case/reference, created-by/event, timestamp, review deadline, status and release/decision audit.

Allowed hold reasons should be explicit, such as:
- return or refund request;
- customer complaint requiring investigation;
- chargeback/payment reversal;
- credible fraud or account-security review;
- provider or bank compliance restriction;
- legal/regulatory instruction;
- verified payout-account risk.

Rules:
- No indefinite or unexplained holds.
- Every hold is reviewable and communicated to the seller where lawful.
- Releasing a hold must re-run all payout eligibility checks.
- Closing a case without a refund should release the affected amount promptly.
- A partial refund/return should adjust only the relevant line items and amount.
- Do not use a routine blanket reserve or delay merely because the marketplace has multiple sellers.
- Do not pay an amount that has already been refunded, reversed, paid or otherwise extinguished.

The customer-facing returns policy and seller agreement must define lawful return rights and any applicable time limits. Engineering must not invent a short return window or silently extinguish statutory rights. A return request received after payout must enter the normal refund/dispute workflow; any seller recovery or future offset must be contractually lawful, evidence-based, itemised and appealable.

## 5. Ledger and accounting invariants

Use an append-only financial ledger or equivalent immutable journal. Do not calculate seller balances by trusting a mutable UI field.

Maintain distinct accounts/entries for:
- customer payment clearing / provider receivable;
- seller payable, per seller and currency;
- Everneed-earned commission and approved service revenue;
- carrier/rider pass-through payable;
- refund and chargeback liabilities;
- provider fees and approved fee allocations;
- payout in transit;
- payout completed;
- adjustments and reversals.

Each journal entry must have a stable source event, order ID, seller-package ID, seller ID, currency, amount in minor units, debit/credit direction, idempotency key, actor/system identity, timestamp and correlation/provider reference. Enforce balanced journal entries and prevent duplicate posting.

Never treat seller payable or carrier pass-through amounts as Everneed operating revenue. Never mix currencies or use floating-point arithmetic for money.

## 6. Provider transfer orchestration

The Paystack transaction verification/webhook path confirms customer collection; it is not proof that seller transfers are implemented or provider-approved.

Before enabling live seller transfers:
1. Obtain written provider approval for the actual marketplace/merchant-of-record structure, collection flow, seller onboarding/recipient requirements, transfers, split payments, refunds, chargebacks and reconciliation.
2. Confirm the correct legal contracting and receiving entity and obtain qualified Nigerian legal/accounting advice.
3. Implement recipient creation/update only after seller identity and bank details are verified, with audit and change controls.
4. Submit transfers server-side only; never expose secret keys or allow clients to choose payable amounts or recipient accounts.
5. Use a unique idempotency key per seller-package payable and a stable provider transfer reference.
6. Persist the transfer instruction before calling the provider; persist provider response and event references.
7. Verify transfer status using provider-confirmed data. A successful HTTP response or queued transfer is not a completed payout.
8. Reconcile provider transfer events/statements against ledger entries. Handle duplicate, delayed, out-of-order and missing webhooks.
9. On timeout, query the original transfer reference before any retry. Retry only after the provider confirms the original instruction did not complete and duplicate-payment risk is controlled.
10. Provide a manual, audited exception/reconciliation queue; no silent admin balance edits.

Do not deploy or enable live transfers until the provider approval and legal/accounting gates are documented. Existing Paystack collection credentials or a working payment webhook do not satisfy these gates.

## 7. Security and permissions

- Buyer delivery confirmation must be authenticated and bound to the buyer's own order/package; seller or admin status changes must use role-checked server/database functions.
- Delivery confirmation must be backed by the approved evidence, not an unrestricted client update.
- Only trusted server-side functions may create payout instructions or change financial states.
- Sellers may read only their own package statements and payout statuses.
- Buyers may not read seller bank details, internal risk notes or other sellers' financial records.
- Admin overrides require a reason, actor identity, before/after values and immutable audit record.
- Bank-detail changes require re-verification and must not redirect an already queued transfer without a controlled cancellation/reissue procedure.
- Secrets remain in server-side secret storage.

## 8. Required automated tests

1. Successful verified payment + confirmed delivery + no case -> one payout eligibility record.
2. Delivery confirmed before payment verification -> no eligibility.
3. Payment amount/currency mismatch, failed, pending or reversed -> no eligibility.
4. Parent order with two sellers: only the delivered seller package becomes eligible.
5. One seller package disputed; another undisputed -> only the affected package/amount is held.
6. Partial return/refund -> proportional package/line-item adjustment; unaffected amount remains eligible.
7. Duplicate delivery event, webhook or worker execution -> no duplicate payable or transfer.
8. Out-of-order delivery, refund and payment events -> deterministic, safe final state.
9. Payout timeout/unknown result -> reconciliation, not blind retry.
10. Provider confirms transfer success -> one settled ledger posting.
11. Provider rejects transfer -> payable remains outstanding and seller is notified.
12. Provider reversal/returned transfer -> reversal journal and payable recovery state.
13. Seller cannot read or mutate another seller's payout records.
14. Buyer cannot mark another buyer's package delivered.
15. Admin adjustment/hold/release is reasoned, permission-checked and audited.
16. Currency and minor-unit rounding invariants hold for all supported currencies.

## 9. Rollout gates and current boundary

Implementation should proceed in this order:
1. Map the existing seller-package schema, payment ledger, refund/dispute tables, RLS and database functions; reuse existing structures where sound.
2. Add package-level settlement eligibility and hold/release logic with database tests.
3. Add an idempotent server-side payout queue and reconciliation worker in non-production/staging.
4. Add seller-facing statement/status UI only after the underlying ledger and RLS tests pass.
5. Run provider-approved test transfers and reconciliation end to end.
6. Obtain legal, accounting and provider sign-off before any production enablement.

This specification does not authorise merging to `main`, production deployment, production database changes, live transfers, or changes to the existing staging/production boundary. Those remain separate controlled steps.

## 10. Acceptance criteria

The feature is ready for controlled staging verification when package-level eligibility, partial holds, ledger invariants, idempotent transfer orchestration, reconciliation, RLS and all tests above pass. It is ready for production only after documented provider, legal, accounting and operational approval.
