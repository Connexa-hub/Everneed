# Everneed Shared Financial Journal — Architecture and Posting Contract

**Status:** Design contract; not a migration  
**Date:** 2026-11-15  
**Branch:** `web-portal`  
**Staging:** `Everneed-staging` (`vjiadqygpyebpisxslbx`)  
**Production:** untouched; no production queries or writes  
**Depends on:** payment lifecycle 026, verified provider refunds, seller entitlement and payout controls.

## 1. Purpose and non-negotiable accounting rules

Everneed needs one authoritative double-entry journal for marketplace commerce, seller liabilities, platform commissions, subscriptions, delivery services, advertising wallets, campaign spend, refunds, chargebacks and manual adjustments.

The existing `public.ledger_entries` is a seller-facing operational subledger, not a general ledger. Preserve it for compatibility while migrating financial authority to a journal. Do not create a separate advertising ledger or mutable wallet balance.

Rules:
1. Every posted journal transaction balances debits and credits for each currency independently.
2. Posted transactions and lines are immutable. Corrections use linked reversal transactions and replacement postings.
3. A transaction is atomic: header, lines, source reference and outbox event commit together.
4. Each source operation has a unique idempotency key and a unique source identity.
5. Currency is explicit on every account, transaction and line. Never balance different currencies together.
6. Amounts use fixed-precision numeric minor-unit-compatible values; currency metadata defines allowed decimal scale and rounding.
7. No browser/client may insert journal headers, lines, account balances or financial projections.
8. Only verified provider events or explicitly authorised internal operations may create financial postings.
9. Wallets and seller balances are projections of journal activity, not mutable source-of-truth columns.
10. Financial posting must not depend on analytics, recommendations, ad serving or dashboard availability.

## 2. Staging facts verified

Read-only inspection of staging confirmed:
- Migration history ends at 025; 026 is not applied.
- `ledger_entries` has bigint ID, text store/order/seller-order IDs, amount numeric, currency default NGN, status values pending/available/paid/reversed, and kinds sale/commission/rental/refund/payout/adjustment.
- A partial unique index `ledger_sale_once` enforces one sale and one commission row per seller order.
- `public.record_payout` is an admin-recorded manual bank transfer record plus negative seller-ledger row; it does not initiate a provider transfer.
- `public.refund` creates an internally processed refund and seller-ledger adjustments; it does not call Paystack.
- `private.confirm_payment_core` marks the order paid and inserts seller sale/commission rows; if order already paid it returns `already` without reconciling a distinct provider transaction.
- `public.release_earnings` releases seller-ledger rows after delivered seller orders and a hold.
- `store_payments` is a subscription/payment history table, not a general provider-attempt or journal table.
- `payouts` records manual payout information and has unique reference.
- Staging has no `finance_accounts` or `finance_postings` tables.

Consequently, do not retrofit these tables into a journal in place. Add a separate journal schema, then bridge existing operational flows gradually.

## 3. Proposed schema boundary

Use a non-exposed schema, provisionally `finance`, for journal internals. Confirm schema exposure and grants during migration review.

### 3.1 Chart of accounts

`finance.accounts`
- id (UUID)
- code (stable unique account code)
- name and description
- account_type: asset, liability, equity, revenue, expense, contra_revenue
- normal_balance: debit or credit
- currency_code (ISO currency)
- owner_scope: platform, store, provider, clearing
- store_id nullable text FK to stores for seller-specific subaccounts where needed
- parent_account_id nullable
- is_control_account, is_postable, is_active
- created_at

Account codes are stable machine identifiers; names may change. Do not create one account per campaign. Use dimensions/source IDs for campaigns and orders.

### 3.2 Journal

`finance.journal_transactions`
- id UUID
- transaction_key text unique (idempotency/source key)
- transaction_type
- status: draft, posted, reversed
- effective_at, posted_at
- currency_code
- source_system, source_type, source_id
- related_transaction_id nullable (reversal/original linkage)
- actor_type, actor_id nullable
- description
- metadata JSONB allowlisted and non-sensitive
- created_at

`finance.journal_lines`
- id UUID
- transaction_id FK
- line_number
- account_id FK
- debit numeric(20,6) default 0
- credit numeric(20,6) default 0
- currency_code
- store_id nullable text
- order_id nullable text
- seller_order_id nullable text
- payment_attempt_id nullable UUID (after 026)
- campaign_id nullable UUID (after advertising migration)
- region_id nullable UUID (after region directory)
- memo
- unique(transaction_id,line_number)

Constraints: exactly one of debit or credit is positive on each line; neither negative; transaction and line currencies match; posted transaction has at least two lines; total debits equal total credits at the configured currency scale. Enforce balance in a trusted posting function/trigger under transaction lock, not only in client validation.

### 3.3 Posting and audit

`finance.posting_sources` or unique source columns on transaction header prevent duplicate postings from provider webhooks, order settlement, payout and ad event consumers.

`finance.journal_reversals` records original transaction, reversal transaction, reason, actor and timestamp.

`finance.accounting_periods` supports open/closed periods. Closed-period corrections post in the current open period with reference to the original; never rewrite closed history.

`finance.audit_events` records privileged configuration, manual adjustment, period close and exceptional release actions. Reuse the existing general audit system where it provides immutable actor/action/target evidence; do not duplicate audit records without a clear reason.

### 3.4 Read models

Create controlled views/RPCs for:
- account balances by account and currency
- store seller payable balance by currency
- store ad wallet available/reserved/spent projections
- platform revenue by revenue stream/currency/period
- provider clearing reconciliation
- journal trial balance
- unbalanced/failed posting exception queue

Views should be read-only, use safe invoker permissions where supported, and never expose another seller's account details. Materialised aggregates are rebuildable and not financial authority.

## 4. Initial chart of accounts

The following is a logical starting chart. Exact codes and legal treatment must be approved before production.

| Code | Account | Type | Normal balance |
|---|---|---|---|
| 1000 | Provider clearing — Paystack | Asset | Debit |
| 1010 | Bank cash / settlement | Asset | Debit |
| 1020 | Cash in transit | Asset | Debit |
| 1100 | Refund receivable / provider recovery | Asset | Debit |
| 2000 | Seller payable control | Liability | Credit |
| 2010 | Seller advertising wallet liability | Liability | Credit |
| 2020 | Campaign prepaid liability | Liability | Credit |
| 2030 | Customer refund payable | Liability | Credit |
| 2040 | Tax payable | Liability | Credit |
| 2050 | Provider settlement payable / fees payable | Liability | Credit |
| 3000 | Platform retained earnings / opening equity | Equity | Credit |
| 4000 | Marketplace commission revenue | Revenue | Credit |
| 4010 | Subscription revenue | Revenue | Credit |
| 4020 | Advertising revenue | Revenue | Credit |
| 4030 | Delivery / fulfilment revenue | Revenue | Credit |
| 4040 | Verification / business service revenue | Revenue | Credit |
| 4090 | Other platform revenue | Revenue | Credit |
| 5000 | Payment processing fees | Expense | Debit |
| 5010 | Delivery and fulfilment costs | Expense | Debit |
| 5020 | Refund and chargeback losses | Expense | Debit |
| 5030 | Advertising credits / contra-revenue | Contra-revenue | Debit |
| 5040 | Fraud and bad-debt losses | Expense | Debit |
| 5090 | Other operating expenses | Expense | Debit |

Store-level seller payable and wallet balances should use account dimensions or controlled per-store subaccounts. Do not expose the account table for direct client writes. If subaccounts are used, ensure the control-account total reconciles to all subsidiary balances.

Tax accounts, FX gain/loss, processor fee recovery, chargeback receivables and settlement suspense may be added when country/payment operations require them. No tax rate or tax liability should be guessed in this contract.

## 5. Posting templates

All examples are conceptual and shown in one currency. Production postings must use the actual settled amount, fees, tax rules and currency-specific rounding.

### 5.1 Customer order payment and marketplace allocation

At provider confirmation:
- Debit provider clearing for the exact settled customer amount.
- Credit seller payable for each seller's payable share.
- Credit marketplace commission revenue for commission earned under the order contract.
- Credit delivery revenue or delivery payable/cost clearing according to who supplied the delivery service.
- Credit tax payable where legally applicable.
- Add any remaining component to a defined clearing/liability account; never force a balancing plug.

The posting must reconcile exactly to the immutable checkout/order snapshot. Multi-seller allocation is item/seller-order based. Never credit every campaign or seller with the full parent order value.

### 5.2 Seller payout

When a payout is approved/initiated:
- Debit seller payable.
- Credit payout clearing / bank settlement payable.

When provider/bank settlement is confirmed:
- Debit payout clearing / bank settlement payable.
- Credit bank cash or provider clearing.

If the current operation remains a manual bank transfer, require an authorised admin, transfer reference, amount, currency, destination verification and evidence. A manual record must not be represented as an API-executed transfer.

### 5.3 Subscription payment

On confirmed payment:
- Debit provider clearing.
- Credit subscription revenue if earned immediately under the approved accounting policy, or credit deferred subscription revenue if service is delivered over a future period.

Recognise deferred revenue over the service period through scheduled, idempotent postings. Keep plan entitlement activation tied to verified payment state, not a client return URL.

### 5.4 Advertising wallet funding

On confirmed wallet funding:
- Debit provider clearing.
- Credit seller advertising wallet liability.

Wallet top-ups are not revenue. The seller owns a contractual claim to unused funds subject to clearly disclosed terms, refund rules and applicable law.

### 5.5 Campaign-specific funding

On confirmed campaign-specific funding:
- Debit provider clearing.
- Credit campaign prepaid liability.

It must be scoped to the exact campaign and cannot be silently transferred to another campaign. If unused funds are refundable or transferable, apply explicit policy and audited reallocation.

### 5.6 CPC/CPM ad delivery and consumption

For a validated billable event:
- Debit seller advertising wallet liability or campaign prepaid liability.
- Credit advertising revenue (plus tax payable where applicable) only when the contracted ad service is delivered and billable.

A budget reservation is an allocation/hold, not a journal revenue event. Keep reservation records separate from journal postings. On campaign pause/cancel, release unused reservation; do not post revenue for undelivered ads.

### 5.7 Refund of unused advertising funds

After provider refund confirmation:
- Debit seller advertising wallet liability or campaign prepaid liability.
- Credit provider clearing / bank cash as applicable.

If a refund is only requested, do not post the cash movement yet. Record a pending refund liability/reservation according to the approved workflow.

### 5.8 Advertising service credit / invalid traffic correction

If Everneed grants a credit for invalid traffic or service failure:
- Debit advertising contra-revenue or an approved service recovery expense.
- Credit seller advertising wallet liability.

Link the credit to original campaign, billing period and event evidence. Never delete the original billable event or journal entry.

### 5.9 Marketplace refund

A confirmed customer refund requires:
- Provider refund confirmation and payment-attempt linkage.
- Debit the correct seller payable, commission revenue reversal, tax payable and/or refund expense according to the original allocation and who bears the loss.
- Credit provider clearing/refund payable for the actual refunded amount.
- Reconcile seller funds already paid out; create recoverable seller balance/debt only under an approved seller agreement and policy.

Do not use current `public.refund` as a provider refund implementation; it records internal status and seller-ledger adjustments only.

### 5.10 Delivery income

Separate customer delivery charge, seller/hub/carrier payable, platform delivery margin and actual delivery costs. Revenue is not automatically equal to the delivery fee collected. Recognition follows the actual principal/agent role and service completion policy, subject to accounting review.

## 6. Legacy seller ledger bridge

The current `ledger_entries` remains readable and operational during transition.

1. Inventory and reconcile existing rows by store, currency, kind, status, order and seller order.
2. Define exactly which legacy entries represent pending seller liability, available seller liability, paid payout, refund, commission and adjustment.
3. Create a controlled bridge mapping each legacy entry to one journal transaction or an explicitly documented opening-balance transaction.
4. Use a unique legacy source key such as `legacy:ledger_entries:<id>` to make import idempotent.
5. Do not sum rows across currencies.
6. Reconcile seller payable per store/currency to the legacy `public.store_balance` semantics before cutover.
7. During dual-write, write journal and legacy projection atomically through one trusted posting service; no independent client write.
8. Compare daily totals and per-store exceptions. Cut over reads only after zero unexplained variance for an agreed observation period.
9. Keep legacy history and compatibility APIs until all clients and operational reports are migrated.

Never create opening balances by blindly summing ledger rows; status semantics and existing payout/refund adjustments must be understood first.

## 7. API/RPC boundary

Only trusted server-side code and narrowly granted RPCs can post.

Proposed internal operations:
- `finance.post_journal_transaction(...)`: validates account/currency/lines, idempotency, source uniqueness, balance and period status.
- `finance.reverse_journal_transaction(transaction_id, reason, actor)`: creates a full or approved partial reversal with linkage.
- `finance.reconcile_provider_settlement(provider, period/reference)`: matches provider settlement to attempts and journal.
- `finance.project_store_balance(store_id,currency)`: read-only projection.
- `finance.project_ad_wallet(store_id,currency)`: read-only projection of journal plus active reservations.
- `finance.close_period(period_id)`: privileged, audited, requires reconciliation checks.
- `finance.record_manual_adjustment(...)`: admin-only, dual approval above configured threshold, reason and evidence reference.

Application APIs:
- Seller: GET balances, transactions, payouts, wallet; submit payout request or funding attempt.
- Admin: view reconciliation exceptions, approve eligible payouts, record manual transfer evidence, manage holds, review journal reports.
- Payment worker: confirm provider attempts and invoke typed posting templates.
- Advertising worker: submit validated billable event; cannot choose account codes or arbitrary debit/credit lines.

Never expose generic debit/credit posting endpoints to customer, seller or browser sessions.

## 8. Concurrency, idempotency and reliability

- Lock relevant store/currency balance projection or use serializable/atomic reservation logic before accepting a payout or campaign budget reservation.
- Use unique idempotency keys for every financial source event and provider reference.
- Webhook delivery is at-least-once; processing must be exactly-once in financial effect.
- Use database transactions for posting header + lines + outbox.
- Retry transient failures; dead-letter irrecoverable events with alert and replay tooling.
- Enforce per-currency balance constraints and account active/postable status.
- Never allow negative seller payable or wallet spendable balance unless an explicitly authorised overdraft/receivable product is designed.
- Daily reconciliation compares provider attempts, settlements, journal clearing accounts, legacy seller ledger and payout records.
- All amounts use decimal arithmetic; no binary floating-point money calculations.

## 9. Security and operations

- Keep journal tables in non-exposed `finance` schema.
- Revoke direct INSERT/UPDATE/DELETE from `anon` and `authenticated`.
- Expose only scoped read APIs/views after row ownership checks.
- Pin `search_path` in SECURITY DEFINER functions and schema-qualify objects.
- Verify actor, permission, idempotency key, source event and account mapping server-side.
- Require dual control for exceptional manual adjustments, write-offs, period close/reopen and high-value payouts.
- Never store card PAN, CVV, bank passwords, identity documents or provider secrets in journal metadata.
- Record immutable audit data for all privileged actions.
- Financial read models must not leak customer personal information to sellers or other stores.

## 10. Acceptance tests before enabling any posting

1. Every posted transaction balances by currency.
2. One-sided, zero, negative, mixed-currency and unbalanced transactions fail.
3. Duplicate source key/provider webhook creates one financial effect.
4. Same idempotency key with different payload fails with conflict.
5. Posted transaction/line mutation and deletion are rejected.
6. Reversal is linked, balanced and does not mutate original.
7. Closed-period posting is rejected; approved correction posts in current period.
8. Seller cannot read another store's balances or journal detail.
9. Admin manual adjustment requires reason and audit; threshold triggers dual approval.
10. Concurrent payout requests cannot overdraw seller payable.
11. Concurrent ad reservations cannot overspend wallet/campaign prepaid liability.
12. Wallet projection equals posted wallet liability less active reservations.
13. Legacy seller ledger bridge is idempotent and reconciles by store/currency/status.
14. Provider clearing balance reconciles to unsettled provider funds.
15. Checkout, order and payment continue if analytics/event consumers are unavailable.
16. Failed posting rolls back the business settlement transaction or enters a durable recoverable state; never mark payment settled while silently losing its financial posting.

## 11. Open accounting decisions before migration

These require business/accounting approval, not developer guesses:
- Principal-versus-agent treatment for delivery and marketplace sales.
- Commission revenue recognition point and refund allocation policy.
- Subscription revenue recognition and cancellation/refund policy.
- Whether unused wallet balance is refundable, transferable, or expires; applicable country-specific legal review.
- Tax treatment and invoicing requirements by launch country.
- FX rate source, quote locking, settlement currency and gain/loss policy.
- Seller negative balance recovery policy after refunds/chargebacks.
- Manual payout dual-approval threshold and evidence retention.
- Accounting period close cadence and retention requirements.

## 12. Build sequence

1. Complete payment lifecycle 026 with immutable payment attempts and webhook reconciliation.
2. Finalise this chart of accounts and posting policy with accounting review.
3. Draft 027 migration for journal schema, accounts, transaction/line constraints, posting/reversal functions and grants.
4. Test journal independently with synthetic staging fixtures.
5. Build the legacy ledger bridge in shadow mode; reconcile without changing existing seller balance reads.
6. Migrate one trusted settlement path at a time, with dual-write and comparison.
7. Add advertising wallet and campaign postings only after the journal and payment/refund flows pass staging gates.
8. Production rollout requires separate explicit approval and a rollback/reconciliation plan.

**No database changes are authorised by this document.**
