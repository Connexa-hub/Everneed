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
