# Finance Ledger and Payouts — Phase 3 Audit

**Date:** 2026-11-16  
**Branch:** `web-portal`  
**Database inspected:** Everneed-staging (`vjiadqygpyebpisxslbx`), read-only  
**Production:** Not queried or changed.

## 1. Verified current model

The current `public.ledger_entries` table is a seller subledger, not a double-entry general ledger. Its fields are:

- `id` (bigint), `store_id`, `order_id`, `seller_order_id`
- `kind`, `amount` (numeric major units), `currency`
- `status`, `note`, `created_at`

The ledger guard prevents deleting entries or editing amount, kind, store, order, seller-order or currency; corrections must be represented by reversing entries. The authenticated read policy allows a store owner to read their own store entries and admins to read all entries.

`public.store_balance(text)` calculates a seller balance by summing available sale/commission/refund/adjustment entries and all payout entries. It is a seller-facing balance calculation, not a balanced accounting journal.

`public.payouts` currently records a store, amount, currency, reference, method, paid timestamp, recorder and period. The `record_payout` RPC:
- requires the server-side admin gate and throttling;
- locks the store row;
- checks the requested amount against `store_balance`;
- inserts a payout record and a negative `payout` seller-ledger entry;
- sends a notification and audit record.

It does **not** initiate a bank transfer, call a payout provider, confirm delivery of funds, or reconcile a provider transfer. A payout row is a record of an administrator-entered payment, not proof of an automated transfer.

## 2. Staging data limitation

At the time of this read-only audit, staging contained:

| Table | Rows |
|---|---:|
| `ledger_entries` | 0 |
| `payouts` | 0 |
| `refunds` | 0 |
| `orders` | 0 |
| `private.payment_attempts` | 0 |

The schema and function contracts can be inspected, but there is no commerce history in staging to reconcile or use for an end-to-end accounting proof. Do not treat empty staging tables as proof that all historic balances reconcile.

## 3. Gaps before finance automation

1. No double-entry journal with debit/credit lines and a per-currency balanced-journal invariant.
2. No chart of accounts separating Paystack clearing, bank cash, seller payable, platform commission revenue, delivery revenue, taxes, refunds payable, fees and adjustments.
3. Seller balance is not yet derived from a general-ledger control account.
4. Payouts are manually recorded; there is no provider transfer request, idempotency key, transfer status lifecycle, provider webhook correlation or bank reconciliation.
5. Refund accounting is currently local bookkeeping and is not gated on Paystack's provider-confirmed refund state; see `PAYMENT_REFUND_AUDIT.md`.
6. Paystack settlement batches and fees are not reconciled to bank statements and the platform's journal.
7. The current ledger is major-unit numeric. Provider APIs use minor units, so every provider boundary needs explicit currency-exponent conversion and rounding rules.
8. The current ledger guard protects core identity/amount fields, but the finance journal should be append-only across all material fields, with reversals rather than mutation.

## 4. Target finance architecture — design only

### Journal core

- `accounts`: immutable account code, type, currency, owner/store scope and active state.
- `journal_transactions`: immutable source event, idempotency key, effective/posted timestamps, currency, source references and metadata.
- `journal_lines`: debit or credit amount in integer minor units, account, currency, optional store/order/seller-order attribution.
- Enforce at posting time that every journal transaction has at least two lines, all lines use one currency, total debits equal total credits, and amounts are positive integers.
- Enforce unique source-event/idempotency identity so retries cannot post twice.
- Never edit or delete posted journals. Correct errors with a linked reversal and replacement journal.
- Derive seller balances from seller-payable control-account movements; retain `ledger_entries` as a compatibility/read model until all clients and reports migrate.

### Core account groups

- Assets: Paystack clearing, bank cash, cash-in-transit and any approved hub inventory/custody accounts.
- Liabilities: seller payable by seller and currency, customer refund payable, tax payable, delivery partner payable and customer funds held.
- Revenue: platform commission, delivery revenue, seller promotion/advertising revenue and other approved platform fees.
- Contra-revenue/expenses: refunds, payment processing fees, chargebacks, operational delivery cost and approved adjustments.

These are account categories, not an instruction to recognize revenue before the relevant delivery, return and settlement policies are agreed.

### Payout lifecycle

A future payout request should be separate from a provider transfer:

`requested → risk/eligibility review → approved → queued → submitted → processing → paid`

Terminal/exception states should include `failed`, `reversed`, `cancelled` and `reconciliation_required`.

- Freeze the requested amount and destination snapshot when approved.
- Check available seller payable under a row lock; prevent concurrent overdraw.
- Submit a provider transfer with a stable idempotency/reference.
- On timeout, verify the same provider reference; never create a second transfer just because the response was lost.
- Only verified provider completion should debit seller payable and credit the cash/clearing account.
- Failed or reversed transfers must release/reinstate the seller payable through explicit journal entries.
- Keep bank details private and never expose them through seller-facing read models.

### Reconciliation

- Import provider settlement and transfer events idempotently.
- Match charge transaction IDs/references, fees, refunds, transfers and settlement batches.
- Reconcile Paystack clearing to actual bank credits, with an exception queue for unmatched, partial, duplicate and delayed items.
- Provide a period close report by currency: opening balance, movements, closing balance, provider clearing balance, bank balance and unresolved differences.

## 5. Business decision confirmed — 16 Nov 2026

The owner approved this seller settlement rule:
- Undisputed seller proceeds become eligible promptly after verified delivery; no arbitrary multi-day platform holding period.
- A return/refund request or active dispute blocks only the affected seller package or amount where the case can be allocated reliably.
- An order-wide case affects all seller packages in that order.
- Undisputed seller packages in the same consolidated delivery may proceed independently at the accounting/eligibility layer.
- Payout orchestration should queue eligible earnings promptly, while actual bank arrival remains subject to provider/bank processing and reconciliation.

Still unresolved and not to be guessed by engineering:
- Paystack's written approval for Everneed's marketplace/merchant-of-record, recipient and seller-transfer structure;
- supported destination countries/currencies and seller KYC/bank-account requirements;
- allocation of delivery fees, taxes, Paystack fees, chargebacks and hub handling costs;
- whether hub-held goods/cash require separate inventory and custody subledgers;
- the legally approved customer return/refund windows and seller recovery/offset terms.

The existing manual payout RPC must not be represented as automated settlement. The confirmed timing decision does not authorise live transfers or bypass the provider, legal and accounting gates.

## 6. Source implementation and staging rollout — migrations 030–033

Migration `033_double_entry_finance_journal.sql` now creates the private chart of accounts, immutable journal headers/lines, seeded currency-specific accounts, service-only balanced posting RPC, source-event idempotency, direct-write restrictions and a linked idempotent full-reversal RPC. Its SQL test verifies balanced posting, idempotent replay, mismatched-content rejection, exact full reversal, reversal idempotency, client isolation and immutability. This migration has now been applied to Everneed-staging; it has not been applied to production. It does not yet map existing seller-ledger events, automate payout transfers or change seller balance calculations.

GitHub Actions run `43799090404` on commit `fcc3230d4d97c9489bb22fb3266b3767c6983c60` completed successfully: full local migration replay, Phase 2 checks, payment recovery tests, migration 033 double-entry journal tests, web checks and Android APK build all passed. This is source/CI verification only. A fresh read-only Supabase migration-ledger query confirms Everneed-staging records migrations 030–033 after 029. No production data has been queried or changed.


## 7. Staging verification update — 16 Nov 2026

- Supabase migration history for Everneed-staging (`vjiadqygpyebpisxslbx`) now records migrations through 033, including 030, 031, 032 and 033.
- Read-only catalog checks confirm `private.finance_accounts`, `private.finance_journals`, `private.finance_journal_lines`, `private.payment_attempts`, `public.claim_stale_payment_attempt_recovery(...)` and `public.claim_provider_event_recovery(...)` exist.
- The seeded chart of accounts contains 96 rows: 16 accounts for each of NGN, GHS, KES, ZAR, GBP and USD.
- Staging currently has zero finance journals, zero journal lines and zero payment attempts. There is no transaction history yet to reconcile.
- CI run `43799090404` passed local Phase 2 and migration 033 SQL tests. The fixture-based Phase 2 SQL script was not run directly against the persistent staging database.
- Production was not queried or changed. No live payout or transfer was initiated.


## 8. Current staging and CI update — 22 Nov 2026

- Staging has migration 034 finance-journal input hardening and FIN-02A migrations through 056, including the unpaid checkout expiry worker.
- Test 056 passed on staging using rollback-only fixtures. Worker ACL: anon/authenticated denied; service_role allowed. No scheduler is enabled and no expiry duration is approved.
- Latest source CI at commit `47641035022231d2027a22e00d5c8a96369fe59f` passed migration validation and the full Build Android app workflow's install/database tests; APK job is intentionally skipped. Subsequent documentation commits have migration validation passing; full workflow is pending on current documentation head.
- The latest direct Paystack settlement source now binds metadata order/user/payment_attempt_id to persisted attempt context and checks amount/currency before calling the settlement RPC. This is source-only; no Edge Function deployed and no sandbox/live payment run.

## 9. FIN-03 finding — successful payment is not yet journaled

Audit of `public.settle_verified_payment_attempt` and `private.confirm_payment_core` found that successful payment currently updates the payment-attempt state, marks the order paid, creates seller `ledger_entries` and seller-order state, notifications and audit data—but does **not** post a balanced finance-journal transaction. Migration 033/034 provide a balanced, immutable, service-only journal API, but the API is not yet wired into payment settlement or order events. This is the next integration task.

### Proposed accounting mapping for a verified v2 card order (design pending tests)

- Debit Paystack clearing for provider-confirmed customer amount.
- Debit platform promotion expense for the platform-funded discount in immutable snapshot v2.
- Credit seller payable by store allocation, using `seller_payable_minor`.
- Credit platform commission revenue using the frozen `commission_minor`.
- Credit delivery revenue using `delivery_fee_minor`, only if that revenue-recognition policy is approved for the delivery state.
- All lines must use the snapshot currency/exponent and be balanced; posting must be in the same database transaction as confirmed settlement, idempotent by order/payment event, and use immutable snapshot values. Do not derive from current product prices or mutable settings.
- The chart of accounts currently has no explicit `expense.platform_promotions` account; this must be added with migration and tests before this mapping can post.
- Delivery revenue recognition, Paystack fee accounting, taxes, partial refunds, chargebacks, returns, and transfer clearing remain separate policy/accounting decisions. This integration must not trigger payouts.

### Implementation gates

1. Add the promotion-expense account for all supported currencies, migration tests, and validate exact snapshot v2 totals/store allocations.
2. Add a private posting helper that fails closed if snapshot is missing, malformed, not v2, currency/exponent mismatch, or totals don't reconcile; never post legacy orders without known facts.
3. Integrate helper into the verified settlement transaction after `confirm_payment_core` reports newly paid. Idempotent retry must return already-settled without duplicate journal; journal source/idempotency key unique.
4. Add rollback SQL fixtures for one store, multiple stores, platform-funded discounts, seller-funded discounts, delivery fee, duplicate settlement, failed journal posting rollback, and ACL.
5. CI pass; apply to staging; run rollback-only staging tests; read-only verify journal balances and matching seller subledger. Keep production and transfer automation disabled.

No live payment or payout has been run. This audit records the gap and proposed accounting design, not an approval to deploy or recognize revenue.


## 10. FIN-03 metadata-binding unit tests added — 22 Nov 2026
The strict provider-to-attempt metadata binding was extracted to `supabase/functions/paystack/payment-context.ts` and is used by the direct Paystack settlement path. Unit tests cover valid match, order/user/attempt ID mismatch, amount mismatch, unsafe integer, currency mismatch and missing context/metadata. CI now runs `deno test` for this helper in addition to Deno type-checking. This is source-level coverage only; it does not simulate a signed webhook, provider verify API, database settlement, campaign consume or finance-journal posting. Await CI before claiming validation.


## 11. Accounting timing caution — payment is not delivery or payout
The Section 9 mapping is a preliminary mapping sketch, not a final posting policy. In particular, the journal must distinguish (a) verified customer cash received, (b) seller obligations and platform commissions, (c) platform-funded promotion, (d) delivery service earned, and (e) actual provider/bank settlement. A conservative payment-receipt entry may debit Paystack clearing and credit a customer-funds-held liability; recognition/reclassification of seller payable, commission, delivery revenue and promotion expense may occur only at policy-defined fulfillment milestones. The exact treatment must align with the existing seller subledger, refunds/returns policy, and merchant-of-record/provider contract. Do not implement the Section 9 entry mapping as written until this timing decision is approved and tests prove it reconciles to seller ledger and order lifecycle. The journal must never count both customer-funds-held and seller-payable for the same amount at the same stage.
